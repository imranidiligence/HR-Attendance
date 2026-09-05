const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require("../utils/response");
const { getPaginationParams } = require("../utils/pagination");

const CARRY_FORWARD_PERCENTAGE = 0.50;

function getLoggedInPrId(req) {
    const prId = req.user?.pr_id ?? req.user?.Pr_Id ?? req.user?.user_id ?? req.user?.id;
    if (!prId) {
        const error = new Error("Employee information not found in JWT token.");
        error.statusCode = 401;
        throw error;
    }
    const parsedPrId = Number(prId);
    if (!Number.isInteger(parsedPrId) || parsedPrId <= 0) {
        const error = new Error("Invalid employee information in JWT token.");
        error.statusCode = 401;
        throw error;
    }
    return parsedPrId;
}

function isValidDate(dateString) {
    if (!dateString || typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
    }
    const date = new Date(`${dateString}T00:00:00Z`);
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
}

function calculateTotalDays(fromDate, toDate) {
    const start = new Date(`${fromDate}T00:00:00Z`);
    const end = new Date(`${toDate}T00:00:00Z`);
    return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function validateYear(year) {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return null;
    }
    return parsedYear;
}

async function withTransaction(callback) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function getLeaveStatusId(client, statusName) {
    const result = await client.query(
        `SELECT ls_leave_status_id FROM public.leave_status WHERE LOWER(ls_leave_status_name) = LOWER($1) AND ls_is_active = TRUE LIMIT 1`,
        [statusName]
    );
    if (result.rows.length === 0) {
        const error = new Error(`Leave status '${statusName}' is not configured.`);
        error.statusCode = 500;
        throw error;
    }
    return result.rows[0].ls_leave_status_id;
}

async function getEmployee(client, prId) {
    const result = await client.query(
        `SELECT o.or_id AS or_id, o.pr_id AS pr_id, o.or_emp_id AS employee_id, o.or_organization_name AS employee_name, o.or_is_active AS is_active, o.or_employee_type_id AS employee_type_id, o.or_reporting_to_id AS reporting_to_id, o.or_department_id AS department_id, o.or_designation_id AS designation_id, o.or_joining_date AS joining_date FROM public.organizations o WHERE o.pr_id = $1 LIMIT 1`,
        [prId]
    );
    if (result.rows.length === 0) {
        const error = new Error("Employee not found.");
        error.statusCode = 404;
        throw error;
    }
    const employee = result.rows[0];
    if (employee.is_active !== true) {
        const error = new Error("Employee is inactive.");
        error.statusCode = 400;
        throw error;
    }
    if (!employee.employee_type_id) {
        const error = new Error("Employee type is not assigned.");
        error.statusCode = 400;
        throw error;
    }
    return employee;
}

async function getEmployeeType(client, employeeTypeId) {
    const result = await client.query(
        `SELECT employee_type_id, employee_type_name, is_active FROM public.employee_type_master WHERE employee_type_id = $1 LIMIT 1`,
        [employeeTypeId]
    );
    if (result.rows.length === 0) {
        const error = new Error("Employee type not found.");
        error.statusCode = 400;
        throw error;
    }
    if (result.rows[0].is_active !== true) {
        const error = new Error("Employee type is inactive.");
        error.statusCode = 400;
        throw error;
    }
    return result.rows[0];
}

async function getApplicableLeaveType(client, prId, leaveTypeId, fromDate, toDate) {
    const employee = await getEmployee(client, prId);
    await getEmployeeType(client, employee.employee_type_id);
    const result = await client.query(
        `SELECT lt.lt_leave_type_id, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_total_days_per_year, lt.lt_is_paid, lt.lt_from_date, lt.lt_to_date, lt.lt_emptype FROM public.leave_types lt WHERE lt.lt_leave_type_id = $1 AND lt.lt_emptype = $2 AND lt.lt_is_active = TRUE AND (lt.lt_from_date IS NULL OR lt.lt_from_date <= $3) AND (lt.lt_to_date IS NULL OR lt.lt_to_date >= $4) LIMIT 1`,
        [leaveTypeId, employee.employee_type_id, fromDate, toDate]
    );
    if (result.rows.length === 0) {
        const error = new Error("Selected leave type is not available for this employee type.");
        error.statusCode = 400;
        throw error;
    }
    return result.rows[0];
}

async function ensureEmployeeQuota(client, prId, year, createdBy) {

    const employee = await getEmployee(client, prId);

    const leaveTypesResult = await client.query(
        `
        SELECT
            lt.lt_leave_type_id,
            lt.lt_leave_type_code,
            lt.lt_leave_type_name,
            COALESCE(
                lt.lt_total_days_per_year,
                0
            ) AS lt_total_days_per_year,
            COALESCE(
                lt.lt_is_paid,
                FALSE
            ) AS lt_is_paid,
            lt.lt_emptype
        FROM public.leave_types lt
        WHERE lt.lt_emptype = $1
          AND lt.lt_is_active = TRUE
          AND (
                lt.lt_from_date IS NULL
                OR lt.lt_from_date <= make_date($2, 12, 31)
          )
          AND (
                lt.lt_to_date IS NULL
                OR lt.lt_to_date >= make_date($2, 1, 1)
          )
        ORDER BY lt.lt_leave_type_id
        `,
        [
            employee.employee_type_id,
            year
        ]
    );

    for (const leaveType of leaveTypesResult.rows) {

        const existingQuotaResult = await client.query(
            `
            SELECT
                lq_id
            FROM public.leave_quota
            WHERE lq_pr_id = $1
              AND lq_leave_type_id = $2
              AND lq_leave_year = $3
            LIMIT 1
            `,
            [
                prId,
                leaveType.lt_leave_type_id,
                year
            ]
        );

        if (existingQuotaResult.rows.length > 0) {
            continue;
        }

        const isPaid =
            Boolean(leaveType.lt_is_paid);

        const masterDays =
            Number(
                leaveType.lt_total_days_per_year
            ) || 0;

        const allocatedDays =
            isPaid ? masterDays : 0;

        let carryForwardDays = 0;

        if (isPaid) {

            const previousYear = year - 1;

            const previousQuotaResult =
                await client.query(
                    `
                    SELECT
                        COALESCE(
                            lq_allocated_days,
                            0
                        ) AS allocated_days,
                        COALESCE(
                            lq_carry_forward_days,
                            0
                        ) AS carry_forward_days,
                        COALESCE(
                            lq_used_days,
                            0
                        ) AS used_days,
                        COALESCE(
                            lq_pending_days,
                            0
                        ) AS pending_days
                    FROM public.leave_quota
                    WHERE lq_pr_id = $1
                      AND lq_leave_type_id = $2
                      AND lq_leave_year = $3
                    LIMIT 1
                    `,
                    [
                        prId,
                        leaveType.lt_leave_type_id,
                        previousYear
                    ]
                );

            if (previousQuotaResult.rows.length > 0) {

                const previous =
                    previousQuotaResult.rows[0];

                const previousAvailable =
                    Math.max(
                        Number(previous.allocated_days || 0) +
                        Number(previous.carry_forward_days || 0) -
                        Number(previous.used_days || 0) -
                        Number(previous.pending_days || 0),
                        0
                    );

                carryForwardDays =
                    Math.floor(
                        previousAvailable *
                        CARRY_FORWARD_PERCENTAGE
                    );
            }
        }

        await client.query(
            `
            INSERT INTO public.leave_quota
            (
                lq_pr_id,
                lq_leave_type_id,
                lq_emptype,
                lq_leave_year,
                lq_allocated_days,
                lq_carry_forward_days,
                lq_used_days,
                lq_pending_days,
                lq_created_at,
                lq_created_by
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                0,
                0,
                CURRENT_TIMESTAMP,
                $7
            )
            ON CONFLICT
            (
                lq_pr_id,
                lq_leave_type_id,
                lq_leave_year
            )
            DO NOTHING
            `,
            [
                prId,
                leaveType.lt_leave_type_id,
                employee.employee_type_id,
                year,
                allocatedDays,
                carryForwardDays,
                createdBy || prId
            ]
        );
    }

    return {
        pr_id: prId,
        employee_type_id: employee.employee_type_id,
        year,
        leave_types: leaveTypesResult.rows.length
    };
}

exports.getMyLeaveSummary = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);

        const year =
            validateYear(req.query.year) ||
            new Date().getFullYear();

        const result = await db.query(
            `
            SELECT
                $1::integer AS pr_id,
                $2::integer AS leave_year,

                COALESCE(q.total_allocated_days, 0)
                    AS total_allocated_days,

                COALESCE(q.total_carry_forward_days, 0)
                    AS total_carry_forward_days,

                COALESCE(q.total_pending_days, 0)
                    AS total_pending_days,

                COALESCE(q.total_used_days, 0)
                    AS total_used_days,

                GREATEST(
                    COALESCE(q.total_allocated_days, 0)
                    + COALESCE(q.total_carry_forward_days, 0)
                    - COALESCE(q.total_used_days, 0)
                    - COALESCE(q.total_pending_days, 0),
                    0
                ) AS remaining_days,

                COALESCE(r.total_requests, 0)
                    AS total_requests,

                COALESCE(r.pending_requests, 0)
                    AS pending_requests,

                COALESCE(r.approved_requests, 0)
                    AS approved_requests,

                COALESCE(r.rejected_requests, 0)
                    AS rejected_requests,

                COALESCE(r.cancelled_requests, 0)
                    AS cancelled_requests,

                COALESCE(u.total_unpaid_leave_days, 0)
                    AS total_unpaid_leave_days,

                COALESCE(u.total_unpaid_leave_requests, 0)
                    AS total_unpaid_leave_requests

            FROM
            (
                SELECT
                    SUM(
                        COALESCE(lq_allocated_days, 0)
                    ) AS total_allocated_days,

                    SUM(
                        COALESCE(lq_carry_forward_days, 0)
                    ) AS total_carry_forward_days,

                    SUM(
                        COALESCE(lq_pending_days, 0)
                    ) AS total_pending_days,

                    SUM(
                        COALESCE(lq_used_days, 0)
                    ) AS total_used_days

                FROM public.leave_quota

                WHERE lq_pr_id = $1
                  AND lq_leave_year = $2
            ) q

            CROSS JOIN
            (
                SELECT
                    COUNT(*) AS total_requests,

                    COUNT(*) FILTER (
                        WHERE LOWER(
                            ls.ls_leave_status_name
                        ) = 'pending'
                    ) AS pending_requests,

                    COUNT(*) FILTER (
                        WHERE LOWER(
                            ls.ls_leave_status_name
                        ) = 'approved'
                    ) AS approved_requests,

                    COUNT(*) FILTER (
                        WHERE LOWER(
                            ls.ls_leave_status_name
                        ) = 'rejected'
                    ) AS rejected_requests,

                    COUNT(*) FILTER (
                        WHERE LOWER(
                            ls.ls_leave_status_name
                        ) = 'cancelled'
                    ) AS cancelled_requests

                FROM public.leave_requests lr

                INNER JOIN public.leave_status ls
                    ON ls.ls_leave_status_id =
                       lr.lr_status_id

                WHERE lr.lr_pr_id = $1
                  AND EXTRACT(
                        YEAR FROM lr.lr_from_date
                      ) = $2
            ) r

            CROSS JOIN
            (
                SELECT
                    COALESCE(
                        SUM(lr.lr_total_days),
                        0
                    ) AS total_unpaid_leave_days,

                    COUNT(*) AS total_unpaid_leave_requests

                FROM public.leave_requests lr

                INNER JOIN public.leave_types lt
                    ON lt.lt_leave_type_id =
                       lr.lr_leave_type_id

                INNER JOIN public.leave_status ls
                    ON ls.ls_leave_status_id =
                       lr.lr_status_id

                WHERE lr.lr_pr_id = $1

                  AND COALESCE(
                        lt.lt_is_paid,
                        FALSE
                      ) = FALSE

                  AND EXTRACT(
                        YEAR FROM lr.lr_from_date
                      ) = $2

                  AND LOWER(
                        ls.ls_leave_status_name
                      ) IN (
                        'pending',
                        'approved'
                      )
            ) u
            `,
            [prId, year]
        );

        return successResponse(
            res,
            200,
            result.rows[0],
            "Leave summary fetched successfully."
        );

    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getMyLeaveTypes = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const year = validateYear(req.query.year) || new Date().getFullYear();
        const result = await withTransaction(async (client) => {
            const employee = await getEmployee(client, prId);
            await ensureEmployeeQuota(client, prId, year, prId);
            const leaveTypesResult = await client.query(
                `SELECT lt.lt_leave_type_id, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_total_days_per_year, lt.lt_is_paid, lq.lq_allocated_days, lq.lq_carry_forward_days, lq.lq_used_days, lq.lq_pending_days, (lq.lq_allocated_days + lq.lq_carry_forward_days - lq.lq_used_days - lq.lq_pending_days) AS available_days FROM public.leave_types lt INNER JOIN public.leave_quota lq ON lq.lq_leave_type_id = lt.lt_leave_type_id AND lq.lq_pr_id = $1 AND lq.lq_leave_year = $2 WHERE lt.lt_emptype = $3 AND lt.lt_is_active = TRUE ORDER BY lt.lt_leave_type_name`,
                [prId, year, employee.employee_type_id]
            );
            return { year, employee_type_id: employee.employee_type_id, leave_types: leaveTypesResult.rows };
        });
        return successResponse(res, 200, result, "Leave types fetched successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getMyLeaveBalance = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const year = validateYear(req.query.year) || new Date().getFullYear();
        const result = await withTransaction(async (client) => {
            const employee = await getEmployee(client, prId);
            await ensureEmployeeQuota(client, prId, year, prId);
            const balanceResult = await client.query(
                `SELECT lq.lq_id, lq.lq_pr_id, lq.lq_leave_type_id, lq.lq_emptype, lq.lq_leave_year, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_is_paid, lq.lq_allocated_days, lq.lq_carry_forward_days, lq.lq_used_days, lq.lq_pending_days, (lq.lq_allocated_days + lq.lq_carry_forward_days - lq.lq_used_days - lq.lq_pending_days) AS lq_available_days FROM public.leave_quota lq INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lq.lq_leave_type_id WHERE lq.lq_pr_id = $1 AND lq.lq_leave_year = $2 ORDER BY lt.lt_leave_type_name`,
                [prId, year]
            );
            return { year, employee_type_id: employee.employee_type_id, balance: balanceResult.rows };
        });
        return successResponse(res, 200, result, "Leave balance fetched successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.applyLeave = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);

        const {
            leave_type_id,
            from_date,
            to_date,
            reason
        } = req.body;

        const leaveTypeId = Number(leave_type_id);

        if (!Number.isInteger(leaveTypeId) || leaveTypeId <= 0) {
            return errorResponse(
                res,
                "Valid leave_type_id is required.",
                400
            );
        }

        if (!isValidDate(from_date)) {
            return errorResponse(
                res,
                "Valid from_date is required in YYYY-MM-DD format.",
                400
            );
        }

        if (!isValidDate(to_date)) {
            return errorResponse(
                res,
                "Valid to_date is required in YYYY-MM-DD format.",
                400
            );
        }

        if (from_date > to_date) {
            return errorResponse(
                res,
                "from_date cannot be greater than to_date.",
                400
            );
        }

        if (
            from_date.substring(0, 4) !==
            to_date.substring(0, 4)
        ) {
            return errorResponse(
                res,
                "Leave request cannot span multiple years. Please submit separate requests.",
                400
            );
        }

        const year = Number(from_date.substring(0, 4));

        const totalDays = calculateTotalDays(
            from_date,
            to_date
        );

        if (totalDays <= 0) {
            return errorResponse(
                res,
                "Invalid leave duration.",
                400
            );
        }

        const result = await withTransaction(async (client) => {

            const employee = await getEmployee(
                client,
                prId
            );

            const reportingResult = await client.query(
                `
                SELECT
                    o.or_reporting_to_id
                FROM public.organizations o
                WHERE o.pr_id = $1
                  AND o.or_is_active = TRUE
                LIMIT 1
                `,
                [prId]
            );

            if (reportingResult.rows.length === 0) {
                const error = new Error(
                    "Employee organization information not found."
                );

                error.statusCode = 400;
                throw error;
            }

            const reportingTo =
                reportingResult.rows[0].or_reporting_to_id;

            if (!reportingTo) {
                const error = new Error(
                    "Reporting manager is not assigned to this employee."
                );

                error.statusCode = 400;
                throw error;
            }

            const leaveType =
                await getApplicableLeaveType(
                    client,
                    prId,
                    leaveTypeId,
                    from_date,
                    to_date
                );

            if (!leaveType) {
                const error = new Error(
                    "Invalid or inactive leave type."
                );

                error.statusCode = 400;
                throw error;
            }

            const isPaid =
                Boolean(leaveType.lt_is_paid);

            await ensureEmployeeQuota(
                client,
                prId,
                year,
                prId
            );

            const pendingStatusId =
                await getLeaveStatusId(
                    client,
                    "Pending"
                );

            const overlapResult =
                await client.query(
                    `
                    SELECT
                        lr.lr_leave_request_id,
                        lr.lr_from_date,
                        lr.lr_to_date,
                        lr.lr_total_days,
                        ls.ls_leave_status_name
                    FROM public.leave_requests lr
                    INNER JOIN public.leave_status ls
                        ON ls.ls_leave_status_id =
                           lr.lr_status_id
                    WHERE lr.lr_pr_id = $1
                      AND lr.lr_leave_type_id = $2
                      AND LOWER(ls.ls_leave_status_name)
                          IN ('pending', 'approved')
                      AND lr.lr_from_date <= $4
                      AND lr.lr_to_date >= $3
                    LIMIT 1
                    `,
                    [
                        prId,
                        leaveTypeId,
                        from_date,
                        to_date
                    ]
                );

            if (overlapResult.rows.length > 0) {
                const existing =
                    overlapResult.rows[0];

                const error = new Error(
                    `Leave already exists from ${existing.lr_from_date} to ${existing.lr_to_date}.`
                );

                error.statusCode = 409;
                throw error;
            }

            const quotaResult =
                await client.query(
                    `
                    SELECT
                        lq_id,

                        COALESCE(
                            lq_allocated_days,
                            0
                        ) AS lq_allocated_days,

                        COALESCE(
                            lq_carry_forward_days,
                            0
                        ) AS lq_carry_forward_days,

                        COALESCE(
                            lq_used_days,
                            0
                        ) AS lq_used_days,

                        COALESCE(
                            lq_pending_days,
                            0
                        ) AS lq_pending_days,

                        (
                            COALESCE(lq_allocated_days, 0)
                            +
                            COALESCE(lq_carry_forward_days, 0)
                            -
                            COALESCE(lq_used_days, 0)
                            -
                            COALESCE(lq_pending_days, 0)
                        ) AS available_days
                    FROM public.leave_quota
                    WHERE lq_pr_id = $1
                      AND lq_leave_type_id = $2
                      AND lq_leave_year = $3
                    FOR UPDATE
                    `,
                    [
                        prId,
                        leaveTypeId,
                        year
                    ]
                );

            if (quotaResult.rows.length === 0) {
                const error = new Error(
                    "Leave quota could not be created."
                );

                error.statusCode = 400;
                throw error;
            }

            const quota = quotaResult.rows[0];

            const availableDays =
                Number(quota.available_days) || 0;

            if (isPaid && availableDays < totalDays) {
                const error = new Error(
                    `Insufficient leave balance. Available: ${availableDays}, Requested: ${totalDays}. Use Unpaid Quota.`
                );

                error.statusCode = 400;
                throw error;
            }

            const insertResult =
                await client.query(
                    `
                    INSERT INTO public.leave_requests
                    (
                        lr_pr_id,
                        lr_leave_type_id,
                        lr_from_date,
                        lr_to_date,
                        lr_total_days,
                        lr_reason,
                        lr_status_id,
                        lr_reporting_to,
                        lr_ismailfromrequester,
                        lr_ismailfromapprover,
                        lr_applied_at,
                        lr_created_at,
                        lr_created_by
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        FALSE,
                        FALSE,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP,
                        $1
                    )
                    RETURNING *
                    `,
                    [
                        prId,
                        leaveTypeId,
                        from_date,
                        to_date,
                        totalDays,
                        reason || null,
                        pendingStatusId,
                        reportingTo
                    ]
                );

            await client.query(
                `
                UPDATE public.leave_quota
                SET
                    lq_pending_days =
                        COALESCE(lq_pending_days, 0) + $1,
                    lq_updated_at =
                        CURRENT_TIMESTAMP,
                    lq_updated_by = $2
                WHERE lq_id = $3
                `,
                [
                    totalDays,
                    prId,
                    quota.lq_id
                ]
            );

            return {
                request: insertResult.rows[0],
                employee_type_id:
                    employee.employee_type_id,
                reporting_to:
                    reportingTo,
                leave_type:
                    leaveType,
                total_days:
                    totalDays,
                is_paid:
                    isPaid,
                available_before:
                    isPaid
                        ? availableDays
                        : null,
                available_after:
                    isPaid
                        ? availableDays - totalDays
                        : null
            };
        });

        return successResponse(
            res,
            200,
            result,
            "Leave applied successfully."
        );

    } catch (error) {

        return handleDbError(
            res,
            error
        );
    }
};

exports.getMyLeaveRequests = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const { page, limit, offset } = getPaginationParams(req);
        const year = req.query.year ? validateYear(req.query.year) : null;
        const status = req.query.status || null;
        const values = [prId];
        let paramIndex = 2;
        let whereClause = `WHERE lr.lr_pr_id = $1`;
        if (year) {
            whereClause += ` AND EXTRACT(YEAR FROM lr.lr_from_date) = $${paramIndex}`;
            values.push(year);
            paramIndex++;
        }
        if (status) {
            whereClause += ` AND LOWER(ls.ls_leave_status_name) = LOWER($${paramIndex})`;
            values.push(status);
            paramIndex++;
        }
        const countResult = await db.query(
            `SELECT COUNT(*) AS total FROM public.leave_requests lr INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id ${whereClause}`,
            values
        );
        const total = Number(countResult.rows[0].total || 0);
        const result = await db.query(
            `SELECT lr.lr_leave_request_id, lr.lr_pr_id, lr.lr_leave_type_id, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_is_paid, lr.lr_from_date, lr.lr_to_date, lr.lr_total_days, lr.lr_reason, ls.ls_leave_status_id, ls.ls_leave_status_name, lr.lr_applied_at, lr.lr_approver_by, lr.lr_approver_at, lr.lr_approver_remark, lr.lr_cancelled_at, lr.lr_cancellation_reason, lr.lr_created_at, lr.lr_updated_at FROM public.leave_requests lr INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lr.lr_leave_type_id INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id ${whereClause} ORDER BY lr.lr_applied_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...values, limit, offset]
        );
        return paginatedResponse(res, result.rows, page, limit, total);
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getLeaveRequestById = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const requestId = Number(req.params.id);
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return errorResponse(res, "Valid leave request ID is required.", 400);
        }
        const result = await db.query(
            `SELECT lr.lr_leave_request_id, lr.lr_pr_id, lr.lr_leave_type_id, lr.lr_from_date, lr.lr_to_date, lr.lr_total_days, lr.lr_reason, lr.lr_status_id, ls.ls_leave_status_name, lr.lr_ismailfromrequester, lr.lr_ismailfromapprover, lr.lr_applied_at, lr.lr_approver_by, lr.lr_approver_at, lr.lr_approver_remark, lr.lr_cancelled_at, lr.lr_cancellation_reason, lr.lr_created_at, lr.lr_updated_at, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_is_paid FROM public.leave_requests lr INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lr.lr_leave_type_id INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id WHERE lr.lr_leave_request_id = $1 AND lr.lr_pr_id = $2 LIMIT 1`,
            [requestId, prId]
        );
        if (result.rows.length === 0) {
            return errorResponse(res, "Leave request not found.", 404);
        }
        return successResponse(res, 200, result.rows[0], "Leave request fetched successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.cancelLeave = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const requestId = Number(req.params.id);
        const reason = req.body?.reason || null;
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return errorResponse(res, "Valid leave request ID is required.", 400);
        }
        const result = await withTransaction(async (client) => {
            const cancelledStatusId = await getLeaveStatusId(client, "Cancelled");
            const requestResult = await client.query(
                `SELECT lr.*, ls.ls_leave_status_name FROM public.leave_requests lr INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id WHERE lr.lr_leave_request_id = $1 AND lr.lr_pr_id = $2 FOR UPDATE`,
                [requestId, prId]
            );
            if (requestResult.rows.length === 0) {
                const error = new Error("Leave request not found.");
                error.statusCode = 404;
                throw error;
            }
            const leaveRequest = requestResult.rows[0];
            const currentStatus = leaveRequest.ls_leave_status_name.toLowerCase();
            if (currentStatus !== "pending" && currentStatus !== "approved") {
                const error = new Error(`Leave cannot be cancelled because current status is ${leaveRequest.ls_leave_status_name}.`);
                error.statusCode = 400;
                throw error;
            }
            const today = new Date().toISOString().slice(0, 10);
            if (leaveRequest.lr_from_date <= today) {
                const error = new Error("Leave cannot be cancelled on or after the leave start date.");
                error.statusCode = 400;
                throw error;
            }
            const quotaResult = await client.query(
                `SELECT * FROM public.leave_quota WHERE lq_pr_id = $1 AND lq_leave_type_id = $2 AND lq_leave_year = EXTRACT(YEAR FROM $3::date) FOR UPDATE`,
                [prId, leaveRequest.lr_leave_type_id, leaveRequest.lr_from_date]
            );
            if (quotaResult.rows.length === 0) {
                const error = new Error("Leave quota not found.");
                error.statusCode = 400;
                throw error;
            }
            const quota = quotaResult.rows[0];
            if (currentStatus === "pending") {
                await client.query(
                    `UPDATE public.leave_quota SET lq_pending_days = GREATEST(lq_pending_days - $1, 0), lq_updated_at = CURRENT_TIMESTAMP, lq_updated_by = $2 WHERE lq_id = $3`,
                    [leaveRequest.lr_total_days, prId, quota.lq_id]
                );
            }
            if (currentStatus === "approved") {
                await client.query(
                    `UPDATE public.leave_quota SET lq_used_days = GREATEST(lq_used_days - $1, 0), lq_updated_at = CURRENT_TIMESTAMP, lq_updated_by = $2 WHERE lq_id = $3`,
                    [leaveRequest.lr_total_days, prId, quota.lq_id]
                );
            }
            const updateResult = await client.query(
                `UPDATE public.leave_requests SET lr_status_id = $1, lr_cancelled_at = CURRENT_TIMESTAMP, lr_cancellation_reason = $2, lr_updated_at = CURRENT_TIMESTAMP, lr_updated_by = $3 WHERE lr_leave_request_id = $4 RETURNING *`,
                [cancelledStatusId, reason, prId, requestId]
            );
            return updateResult.rows[0];
        });
        return successResponse(res, 200, result, "Leave cancelled successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getPendingApprovals = async (req, res) => {
    try {
        const approverPrId = getLoggedInPrId(req);
        const { page, limit, offset } = getPaginationParams(req);
        const whereClause = `WHERE LOWER(ls.ls_leave_status_name) = 'pending' AND manager.pr_id = $1`;
        const countResult = await db.query(
            `SELECT COUNT(*) AS total FROM public.leave_requests lr INNER JOIN public.organizations employee ON employee.pr_id = lr.lr_pr_id INNER JOIN public.organizations manager ON manager.or_id = employee.or_reporting_to_id INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id ${whereClause}`,
            [approverPrId]
        );
        const total = Number(countResult.rows[0]?.total || 0);
        const result = await db.query(
            `SELECT lr.lr_leave_request_id, lr.lr_pr_id, employee.or_emp_id AS employee_id, employee.or_organization_name AS employee_name, employee.or_department_id AS department_id, employee.or_designation_id AS designation_id, lr.lr_leave_type_id, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_is_paid, lr.lr_from_date, lr.lr_to_date, lr.lr_total_days, lr.lr_reason, lr.lr_applied_at, ls.ls_leave_status_id, ls.ls_leave_status_name FROM public.leave_requests lr INNER JOIN public.organizations employee ON employee.pr_id = lr.lr_pr_id INNER JOIN public.organizations manager ON manager.or_id = employee.or_reporting_to_id INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lr.lr_leave_type_id INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id ${whereClause} ORDER BY lr.lr_applied_at ASC LIMIT $2 OFFSET $3`,
            [approverPrId, limit, offset]
        );
        return paginatedResponse(res, 200, result.rows, page, limit, total);
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.approveLeave = async (req, res) => {
    try {
        const approverPrId = getLoggedInPrId(req);
        const requestId = Number(req.params.id);
        const remark = req.body?.remark || null;
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return errorResponse(res, "Valid leave request ID is required.", 400);
        }
        const result = await withTransaction(async (client) => {
            const approvedStatusId = await getLeaveStatusId(client, "Approved");
            const requestResult = await client.query(
                `SELECT lr.*, ls.ls_leave_status_name, employee.or_id AS employee_or_id, employee.pr_id AS employee_pr_id, employee.or_reporting_to_id, manager.pr_id AS manager_pr_id FROM public.leave_requests lr INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id INNER JOIN public.organizations employee ON employee.pr_id = lr.lr_pr_id INNER JOIN public.organizations manager ON manager.or_id = employee.or_reporting_to_id WHERE lr.lr_leave_request_id = $1 FOR UPDATE OF lr`,
                [requestId]
            );
            if (requestResult.rows.length === 0) {
                const error = new Error("Leave request not found.");
                error.statusCode = 404;
                throw error;
            }
            const leaveRequest = requestResult.rows[0];
            if (Number(leaveRequest.manager_pr_id) !== Number(approverPrId)) {
                const error = new Error("You are not authorized to approve this leave request.");
                error.statusCode = 403;
                throw error;
            }
            const currentStatus = String(leaveRequest.ls_leave_status_name || "").toLowerCase();
            if (currentStatus !== "pending") {
                const error = new Error(`Leave cannot be approved because current status is ${leaveRequest.ls_leave_status_name}.`);
                error.statusCode = 400;
                throw error;
            }
            const quotaResult = await client.query(
                `SELECT * FROM public.leave_quota WHERE lq_pr_id = $1 AND lq_leave_type_id = $2 AND lq_leave_year = EXTRACT(YEAR FROM $3::date) FOR UPDATE`,
                [leaveRequest.lr_pr_id, leaveRequest.lr_leave_type_id, leaveRequest.lr_from_date]
            );
            if (quotaResult.rows.length === 0) {
                const error = new Error("Leave quota not found.");
                error.statusCode = 400;
                throw error;
            }
            const quota = quotaResult.rows[0];
            const pendingDays = Number(quota.lq_pending_days || 0);
            const requestedDays = Number(leaveRequest.lr_total_days || 0);
            if (pendingDays < requestedDays) {
                const error = new Error("Invalid quota state. Pending leave balance is insufficient.");
                error.statusCode = 409;
                throw error;
            }
            await client.query(
                `UPDATE public.leave_quota SET lq_pending_days = lq_pending_days - $1, lq_used_days = lq_used_days + $1, lq_updated_at = CURRENT_TIMESTAMP, lq_updated_by = $2 WHERE lq_id = $3`,
                [requestedDays, approverPrId, quota.lq_id]
            );
            const updateResult = await client.query(
                `UPDATE public.leave_requests SET lr_status_id = $1, lr_approver_by = $2, lr_approver_at = CURRENT_TIMESTAMP, lr_approver_remark = $3, lr_ismailfromapprover = FALSE, lr_updated_at = CURRENT_TIMESTAMP, lr_updated_by = $2 WHERE lr_leave_request_id = $4 RETURNING *`,
                [approvedStatusId, approverPrId, remark, requestId]
            );
            return { request: updateResult.rows[0], quota: { lq_id: quota.lq_id, pending_days_before: pendingDays, pending_days_after: pendingDays - requestedDays, used_days_before: Number(quota.lq_used_days || 0), used_days_after: Number(quota.lq_used_days || 0) + requestedDays } };
        });
        return successResponse(res, 200, result, "Leave approved successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};


exports.editLeave = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const requestId = Number(req.params.id);

        const {
            leave_type_id,
            from_date,
            to_date,
            reason
        } = req.body;

        if (!Number.isInteger(requestId) || requestId <= 0) {
            return errorResponse(res, "Valid leave request ID is required.", 400);
        }

        if (!leave_type_id) {
            return errorResponse(res, "Leave type is required.", 400);
        }

        if (!isValidDate(from_date) || !isValidDate(to_date)) {
            return errorResponse(
                res,
                "Valid from_date and to_date are required in YYYY-MM-DD format.",
                400
            );
        }

        if (from_date > to_date) {
            return errorResponse(
                res,
                "From date cannot be greater than to date.",
                400
            );
        }

        const requestedDays = calculateTotalDays(from_date, to_date);

        const result = await withTransaction(async (client) => {

 
            const pendingStatusId =
                await getLeaveStatusId(client, "Pending");

            const approvedStatusId =
                await getLeaveStatusId(client, "Approved");

            const rejectedStatusId =
                await getLeaveStatusId(client, "Rejected");

            const cancelledStatusId =
                await getLeaveStatusId(client, "Cancelled");


         
            const requestResult = await client.query(
                `
                SELECT
                    lr.*,
                    ls.ls_leave_status_name,
                    lt.lt_leave_type_name,
                    lt.lt_is_paid,
                    lt.lt_emptype
                FROM public.leave_requests lr

                INNER JOIN public.leave_status ls
                    ON ls.ls_leave_status_id = lr.lr_status_id

                INNER JOIN public.leave_types lt
                    ON lt.lt_leave_type_id = lr.lr_leave_type_id

                WHERE lr.lr_leave_request_id = $1

                FOR UPDATE
                `,
                [requestId]
            );

            if (requestResult.rows.length === 0) {
                const error = new Error(
                    "Leave request not found."
                );

                error.statusCode = 404;
                throw error;
            }

            const oldRequest = requestResult.rows[0];



            if (Number(oldRequest.lr_pr_id) !== Number(prId)) {
                const error = new Error(
                    "You are not authorized to edit this leave request."
                );

                error.statusCode = 403;
                throw error;
            }


        

            const currentStatus =
                String(
                    oldRequest.ls_leave_status_name || ""
                ).toLowerCase();


            const editableStatuses = [
                "pending",
                "approved",
                "rejected",
                "cancelled"
            ];

            if (!editableStatuses.includes(currentStatus)) {
                const error = new Error(
                    `Leave cannot be edited because current status is ${oldRequest.ls_leave_status_name}.`
                );

                error.statusCode = 400;
                throw error;
            }


   

            const employee = await getEmployee(
                client,
                prId
            );


      

            const newLeaveType =
                await getApplicableLeaveType(
                    client,
                    prId,
                    Number(leave_type_id),
                    from_date,
                    to_date
                );


            const oldLeaveTypeId =
                Number(oldRequest.lr_leave_type_id);

            const newLeaveTypeId =
                Number(leave_type_id);

            const oldDays =
                Number(oldRequest.lr_total_days || 0);


            const fromYear =
                Number(from_date.substring(0, 4));

            const toYear =
                Number(to_date.substring(0, 4));

            if (fromYear !== toYear) {
                return (() => {
                    const error = new Error(
                        "Leave dates must belong to the same year."
                    );

                    error.statusCode = 400;
                    throw error;
                })();
            }


            const overlapResult = await client.query(
                `
                SELECT
                    lr.lr_leave_request_id,
                    lr.lr_from_date,
                    lr.lr_to_date,
                    lr.lr_total_days,
                    ls.ls_leave_status_name
                FROM public.leave_requests lr

                INNER JOIN public.leave_status ls
                    ON ls.ls_leave_status_id = lr.lr_status_id

                WHERE lr.lr_pr_id = $1

                  AND lr.lr_leave_request_id <> $2

                  AND lr.lr_leave_type_id = $3

                  AND LOWER(ls.ls_leave_status_name)
                      IN ('pending', 'approved')

                  AND lr.lr_from_date <= $4::date
                  AND lr.lr_to_date >= $5::date

                LIMIT 1
                `,
                [
                    prId,
                    requestId,
                    newLeaveTypeId,
                    to_date,
                    from_date
                ]
            );

            if (overlapResult.rows.length > 0) {
                const error = new Error(
                    `Leave dates overlap with another ${newLeaveType.lt_leave_type_name} request.`
                );

                error.statusCode = 409;
                throw error;
            }

            const oldQuotaResult = await client.query(
                `
                SELECT *
                FROM public.leave_quota

                WHERE lq_pr_id = $1
                  AND lq_leave_type_id = $2
                  AND lq_leave_year = $3

                FOR UPDATE
                `,
                [
                    prId,
                    oldLeaveTypeId,
                    Number(
                        String(oldRequest.lr_from_date)
                            .substring(0, 4)
                    )
                ]
            );


            const newQuotaResult = await client.query(
                `
                SELECT *
                FROM public.leave_quota

                WHERE lq_pr_id = $1
                  AND lq_leave_type_id = $2
                  AND lq_leave_year = $3

                FOR UPDATE
                `,
                [
                    prId,
                    newLeaveTypeId,
                    fromYear
                ]
            );



            let oldQuota = null;
            let newQuota = null;

            if (oldQuotaResult.rows.length > 0) {
                oldQuota = oldQuotaResult.rows[0];
            }

            if (newQuotaResult.rows.length > 0) {
                newQuota = newQuotaResult.rows[0];
            }



            const oldConsumesQuota =
                currentStatus === "pending" ||
                currentStatus === "approved";


            if (newLeaveType.lt_is_paid === true) {

                if (!newQuota) {
                    const error = new Error(
                        "Leave quota not found for the selected leave type."
                    );

                    error.statusCode = 400;
                    throw error;
                }


                let availableDays =
                    Number(newQuota.lq_allocated_days || 0)
                    +
                    Number(newQuota.lq_carry_forward_days || 0)
                    -
                    Number(newQuota.lq_used_days || 0)
                    -
                    Number(newQuota.lq_pending_days || 0);



                if (
                    oldConsumesQuota &&
                    oldLeaveTypeId === newLeaveTypeId
                ) {
                    if (currentStatus === "pending") {
                        availableDays += oldDays;
                    }

                    if (currentStatus === "approved") {
                        availableDays += oldDays;
                    }
                }


                if (availableDays < requestedDays) {
                    const error = new Error(
                        `Insufficient leave balance. Available: ${availableDays}, Requested: ${requestedDays}.Use Unpaid Quota.`
                    );

                    error.statusCode = 400;
                    throw error;
                }
            }



            if (oldConsumesQuota && oldQuota) {

                if (currentStatus === "pending") {

                    await client.query(
                        `
                        UPDATE public.leave_quota

                        SET
                            lq_pending_days =
                                GREATEST(
                                    lq_pending_days - $1,
                                    0
                                ),

                            lq_updated_at =
                                CURRENT_TIMESTAMP,

                            lq_updated_by = $2

                        WHERE lq_id = $3
                        `,
                        [
                            oldDays,
                            prId,
                            oldQuota.lq_id
                        ]
                    );
                }


                if (currentStatus === "approved") {

                    await client.query(
                        `
                        UPDATE public.leave_quota

                        SET
                            lq_used_days =
                                GREATEST(
                                    lq_used_days - $1,
                                    0
                                ),

                            lq_updated_at =
                                CURRENT_TIMESTAMP,

                            lq_updated_by = $2

                        WHERE lq_id = $3
                        `,
                        [
                            oldDays,
                            prId,
                            oldQuota.lq_id
                        ]
                    );
                }
            }


            if (!newQuota) {

                if (newLeaveType.lt_is_paid === true) {
                    const error = new Error(
                        "Leave quota not found for the selected leave type."
                    );

                    error.statusCode = 400;
                    throw error;
                }

            } else {

                await client.query(
                    `
                    UPDATE public.leave_quota

                    SET
                        lq_pending_days =
                            lq_pending_days + $1,

                        lq_updated_at =
                            CURRENT_TIMESTAMP,

                        lq_updated_by = $2

                    WHERE lq_id = $3
                    `,
                    [
                        requestedDays,
                        prId,
                        newQuota.lq_id
                    ]
                );
            }


            const updateResult = await client.query(
                `
                UPDATE public.leave_requests

                SET
                    lr_leave_type_id = $1,
                    lr_from_date = $2,
                    lr_to_date = $3,
                    lr_total_days = $4,
                    lr_reason = $5,

                    /*
                     * Every edit requires manager approval again.
                     */
                    lr_status_id = $6,

                    /*
                     * Clear old approval information.
                     */
                    lr_approver_by = NULL,
                    lr_approver_at = NULL,
                    lr_approver_remark = NULL,

                    lr_ismailfromapprover = FALSE,

                    lr_updated_at =
                        CURRENT_TIMESTAMP,

                    lr_updated_by = $7

                WHERE lr_leave_request_id = $8

                RETURNING *
                `,
                [
                    newLeaveTypeId,
                    from_date,
                    to_date,
                    requestedDays,
                    reason || null,
                    pendingStatusId,
                    prId,
                    requestId
                ]
            );


            return {
                request: updateResult.rows[0],

                previous_status:
                    oldRequest.ls_leave_status_name,

                new_status: "Pending",

                previous_leave_type_id:
                    oldLeaveTypeId,

                new_leave_type_id:
                    newLeaveTypeId,

                previous_days:
                    oldDays,

                new_days:
                    requestedDays,

                quota_status:
                    "Pending days updated successfully"
            };
        });


        return successResponse(
            res,
            200,
            result,
            "Leave request edited successfully and sent for approval again."
        );

    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getMyLeaveRequests = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const { page, limit, offset } = getPaginationParams(req);

        const countResult = await db.query(
            `SELECT COUNT(*) AS total
             FROM public.leave_requests
             WHERE lr_pr_id = $1`,
            [prId]
        );

        const total = Number(countResult.rows[0].total);

        const result = await db.query(
            `SELECT
                lr.lr_leave_request_id,
                lr.lr_pr_id,
                lr.lr_leave_type_id,
                lt.lt_leave_type_code,
                lt.lt_leave_type_name,
                lt.lt_total_days_per_year,
                lt.lt_is_paid,
                lr.lr_from_date,
                lr.lr_to_date,
                lr.lr_total_days,
                lr.lr_reason,
                lr.lr_status_id,
                ls.ls_leave_status_name AS request_status,
                lr.lr_ismailfromrequester,
                lr.lr_applied_at,
                lr.lr_approver_by,
                lr.lr_approver_at,
                lr.lr_approver_remark,
                lr.lr_ismailfromapprover,
                lr.lr_cancelled_at,
                lr.lr_cancellation_reason,
                lr.lr_created_at,
                lr.lr_created_by,
                lr.lr_updated_at,
                lr.lr_updated_by
             FROM public.leave_requests lr
             INNER JOIN public.leave_types lt
                ON lt.lt_leave_type_id = lr.lr_leave_type_id
             INNER JOIN public.leave_status ls
                ON ls.ls_leave_status_id = lr.lr_status_id
             WHERE lr.lr_pr_id = $1
             ORDER BY lr.lr_created_at DESC
             LIMIT $2 OFFSET $3`,
            [prId, limit, offset]
        );

        return paginatedResponse(
            res,
            200,
            result.rows,
            page,
            limit,
            total
        );
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.rejectLeave = async (req, res) => {
    try {
        const approverPrId = getLoggedInPrId(req);
        const requestId = Number(req.params.id);
        const remark = req.body?.remark || null;
        if (!Number.isInteger(requestId) || requestId <= 0) {
            return errorResponse(res, "Valid leave request ID is required.", 400);
        }
        const result = await withTransaction(async (client) => {
            const rejectedStatusId = await getLeaveStatusId(client, "Rejected");
            const requestResult = await client.query(
                `SELECT lr.*, ls.ls_leave_status_name, employee.or_id AS employee_or_id, employee.pr_id AS employee_pr_id, employee.or_reporting_to_id, manager.pr_id AS manager_pr_id FROM public.leave_requests lr INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id INNER JOIN public.organizations employee ON employee.pr_id = lr.lr_pr_id INNER JOIN public.organizations manager ON manager.or_id = employee.or_reporting_to_id WHERE lr.lr_leave_request_id = $1 FOR UPDATE OF lr`,
                [requestId]
            );
            if (requestResult.rows.length === 0) {
                const error = new Error("Leave request not found.");
                error.statusCode = 404;
                throw error;
            }
            const leaveRequest = requestResult.rows[0];
            if (Number(leaveRequest.manager_pr_id) !== Number(approverPrId)) {
                const error = new Error("You are not authorized to reject this leave request.");
                error.statusCode = 403;
                throw error;
            }
            const currentStatus = String(leaveRequest.ls_leave_status_name || "").toLowerCase();
            if (currentStatus !== "pending") {
                const error = new Error(`Leave cannot be rejected because current status is ${leaveRequest.ls_leave_status_name}.`);
                error.statusCode = 400;
                throw error;
            }
            const quotaResult = await client.query(
                `SELECT lq_id, lq_pr_id, lq_leave_type_id, lq_leave_year, lq_allocated_days, lq_carry_forward_days, lq_used_days, lq_pending_days FROM public.leave_quota WHERE lq_pr_id = $1 AND lq_leave_type_id = $2 AND lq_leave_year = EXTRACT(YEAR FROM $3::date) FOR UPDATE`,
                [leaveRequest.lr_pr_id, leaveRequest.lr_leave_type_id, leaveRequest.lr_from_date]
            );
            if (quotaResult.rows.length === 0) {
                const error = new Error("Leave quota not found.");
                error.statusCode = 400;
                throw error;
            }
            const quota = quotaResult.rows[0];
            const pendingDays = Number(quota.lq_pending_days || 0);
            const requestedDays = Number(leaveRequest.lr_total_days || 0);
            if (pendingDays < requestedDays) {
                const error = new Error("Invalid quota state. Pending leave balance is insufficient.");
                error.statusCode = 409;
                throw error;
            }
            await client.query(
                `UPDATE public.leave_quota SET lq_pending_days = GREATEST(lq_pending_days - $1, 0), lq_updated_at = CURRENT_TIMESTAMP, lq_updated_by = $2 WHERE lq_id = $3`,
                [requestedDays, approverPrId, quota.lq_id]
            );
            const updateResult = await client.query(
                `UPDATE public.leave_requests SET lr_status_id = $1, lr_approver_by = $2, lr_approver_at = CURRENT_TIMESTAMP, lr_approver_remark = $3, lr_ismailfromapprover = FALSE, lr_updated_at = CURRENT_TIMESTAMP, lr_updated_by = $2 WHERE lr_leave_request_id = $4 RETURNING *`,
                [rejectedStatusId, approverPrId, remark, requestId]
            );
            return { request: updateResult.rows[0], quota: { lq_id: quota.lq_id, pending_days_before: pendingDays, pending_days_after: pendingDays - requestedDays, used_days: Number(quota.lq_used_days || 0), released_days: requestedDays } };
        });
        return successResponse(res, 200, result, "Leave rejected successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getAllLeaveRequests = async (req, res) => {
    try {
        const { page, limit, offset } = getPaginationParams(req);
        const year = req.query.year ? validateYear(req.query.year) : null;
        const status = req.query.status || null;
        const employeePrId = req.query.pr_id ? Number(req.query.pr_id) : null;
        const values = [];
        let paramIndex = 1;
        let whereClause = `WHERE 1 = 1`;
        if (year) {
            whereClause += ` AND EXTRACT(YEAR FROM lr.lr_from_date) = $${paramIndex}`;
            values.push(year);
            paramIndex++;
        }
        if (status) {
            whereClause += ` AND LOWER(ls.ls_leave_status_name) = LOWER($${paramIndex})`;
            values.push(status);
            paramIndex++;
        }
        if (employeePrId && Number.isInteger(employeePrId)) {
            whereClause += ` AND lr.lr_pr_id = $${paramIndex}`;
            values.push(employeePrId);
            paramIndex++;
        }
        const countResult = await db.query(
            `SELECT COUNT(*) AS total FROM public.leave_requests lr INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id ${whereClause}`,
            values
        );
        const total = Number(countResult.rows[0].total || 0);
        const result = await db.query(
            `SELECT lr.lr_leave_request_id, lr.lr_pr_id, employee.or_emp_id AS employee_id, employee.or_organization_name AS employee_name, employee.or_department_id AS department_id, employee.or_designation_id AS designation_id, lr.lr_leave_type_id, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_is_paid, lr.lr_from_date, lr.lr_to_date, lr.lr_total_days, lr.lr_reason, ls.ls_leave_status_id, ls.ls_leave_status_name, lr.lr_applied_at, lr.lr_approver_by, lr.lr_approver_at, lr.lr_approver_remark, lr.lr_cancelled_at, lr.lr_cancellation_reason, lr.lr_created_at, lr.lr_updated_at FROM public.leave_requests lr INNER JOIN public.organizations employee ON employee.pr_id = lr.lr_pr_id INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lr.lr_leave_type_id INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id ${whereClause} ORDER BY lr.lr_applied_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...values, limit, offset]
        );
        return paginatedResponse(res, result.rows, page, limit, total);
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getEmployeeLeaveBalance = async (req, res) => {
    try {
        const employeePrId = Number(req.params.prId);
        if (!Number.isInteger(employeePrId) || employeePrId <= 0) {
            return errorResponse(res, "Valid employee pr_id is required.", 400);
        }
        const year = validateYear(req.query.year) || new Date().getFullYear();
        const result = await withTransaction(async (client) => {
            const employee = await getEmployee(client, employeePrId);
            await ensureEmployeeQuota(client, employeePrId, year, getLoggedInPrId(req));
            const balanceResult = await client.query(
                `SELECT lq.lq_id, lq.lq_pr_id, lq.lq_leave_type_id, lq.lq_emptype, lq.lq_leave_year, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_is_paid, lq.lq_allocated_days, lq.lq_carry_forward_days, lq.lq_used_days, lq.lq_pending_days, (lq.lq_allocated_days + lq.lq_carry_forward_days - lq.lq_used_days - lq.lq_pending_days) AS available_days FROM public.leave_quota lq INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lq.lq_leave_type_id WHERE lq.lq_pr_id = $1 AND lq.lq_leave_year = $2 ORDER BY lt.lt_leave_type_name`,
                [employeePrId, year]
            );
            return { employee: { pr_id: employee.pr_id, employee_id: employee.employee_id, employee_type_id: employee.employee_type_id }, year, balance: balanceResult.rows };
        });
        return successResponse(res, 200, result, "Employee leave balance fetched successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getEmployeeLeaveRequests = async (req, res) => {
    try {
        const employeePrId = Number(req.params.prId);
        if (!Number.isInteger(employeePrId) || employeePrId <= 0) {
            return errorResponse(res, "Valid employee pr_id is required.", 400);
        }
        const { page, limit, offset } = getPaginationParams(req);
        const year = req.query.year ? validateYear(req.query.year) : null;
        const values = [employeePrId];
        let paramIndex = 2;
        let whereClause = `WHERE lr.lr_pr_id = $1`;
        if (year) {
            whereClause += ` AND EXTRACT(YEAR FROM lr.lr_from_date) = $${paramIndex}`;
            values.push(year);
            paramIndex++;
        }
        const countResult = await db.query(
            `SELECT COUNT(*) AS total FROM public.leave_requests lr ${whereClause}`,
            values
        );
        const total = Number(countResult.rows[0].total || 0);
        const result = await db.query(
            `SELECT lr.lr_leave_request_id, lr.lr_pr_id, lt.lt_leave_type_code, lt.lt_leave_type_name, lt.lt_is_paid, lr.lr_from_date, lr.lr_to_date, lr.lr_total_days, lr.lr_reason, ls.ls_leave_status_id, ls.ls_leave_status_name, lr.lr_applied_at, lr.lr_approver_by, lr.lr_approver_at, lr.lr_approver_remark, lr.lr_cancelled_at, lr.lr_cancellation_reason FROM public.leave_requests lr INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lr.lr_leave_type_id INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id ${whereClause} ORDER BY lr.lr_applied_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...values, limit, offset]
        );
        return paginatedResponse(res, result.rows, page, limit, total);
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getLeaveDashboard = async (req, res) => {
    try {
        const prId = getLoggedInPrId(req);
        const year = validateYear(req.query.year) || new Date().getFullYear();
        const result = await withTransaction(async (client) => {
            await ensureEmployeeQuota(client, prId, year, prId);
            const summaryResult = await client.query(
                `SELECT COUNT(*) AS total_leave_types, COALESCE(SUM(lq_allocated_days), 0) AS total_allocated_days, COALESCE(SUM(lq_carry_forward_days), 0) AS total_carry_forward_days, COALESCE(SUM(lq_used_days), 0) AS total_used_days, COALESCE(SUM(lq_pending_days), 0) AS total_pending_days, COALESCE(SUM(lq_allocated_days + lq_carry_forward_days - lq_used_days - lq_pending_days), 0) AS total_available_days FROM public.leave_quota WHERE lq_pr_id = $1 AND lq_leave_year = $2`,
                [prId, year]
            );
            const recentResult = await client.query(
                `SELECT lr.lr_leave_request_id, lt.lt_leave_type_name, lr.lr_from_date, lr.lr_to_date, lr.lr_total_days, ls.ls_leave_status_name, lr.lr_applied_at FROM public.leave_requests lr INNER JOIN public.leave_types lt ON lt.lt_leave_type_id = lr.lr_leave_type_id INNER JOIN public.leave_status ls ON ls.ls_leave_status_id = lr.lr_status_id WHERE lr.lr_pr_id = $1 ORDER BY lr.lr_applied_at DESC LIMIT 5`,
                [prId]
            );
            return { year, summary: summaryResult.rows[0], recent_requests: recentResult.rows };
        });
        return successResponse(res, 200, result, "Leave dashboard fetched successfully.");
    } catch (error) {
        return handleDbError(res, error);
    }
};

exports.getManagerLeaveRequests = async (req, res) => {
    try {
        const managerPrId = getLoggedInPrId(req);

        const { page, limit, offset } = getPaginationParams(req);

        const countResult = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM public.leave_requests lr

            INNER JOIN public.organizations employee
                ON employee.pr_id = lr.lr_pr_id

            INNER JOIN public.organizations manager
                ON manager.or_id = employee.or_reporting_to_id

            INNER JOIN public.leave_status ls
                ON ls.ls_leave_status_id = lr.lr_status_id

            WHERE manager.pr_id = $1
              AND employee.or_is_active = TRUE
            `,
            [managerPrId]
        );

        const total = Number(countResult.rows[0].total);

        const result = await db.query(
            `
            SELECT
                lr.lr_leave_request_id,
                lr.lr_pr_id,

                employee.or_id AS employee_or_id,
                employee.or_emp_id AS employee_id,
                employee.or_organization_name AS employee_name,
                employee.Or_Official_Email,
                employee.Or_Official_Contact,
                pr.Pr_First_Name,
                pr.Pr_Last_Name,
                lr.lr_leave_type_id,
                lt.lt_leave_type_code,
                lt.lt_leave_type_name,
                lt.lt_total_days_per_year,
                lt.lt_is_paid,

                lr.lr_from_date,
                lr.lr_to_date,
                lr.lr_total_days,
                lr.lr_reason,

                lr.lr_status_id,
                ls.ls_leave_status_name AS request_status,

                lr.lr_ismailfromrequester,
                lr.lr_applied_at,

                lr.lr_approver_by,
                lr.lr_approver_at,
                lr.lr_approver_remark,
                lr.lr_ismailfromapprover,

                lr.lr_cancelled_at,
                lr.lr_cancellation_reason,

                lr.lr_created_at,
                lr.lr_created_by,
                lr.lr_updated_at,
                lr.lr_updated_by

            FROM public.leave_requests lr

            INNER JOIN public.organizations employee
                ON employee.pr_id = lr.lr_pr_id

                INNER JOIN public.Personal pr
                ON pr.pr_id = lr.lr_pr_id

            INNER JOIN public.organizations manager
                ON manager.or_id = employee.or_reporting_to_id

            INNER JOIN public.leave_types lt
                ON lt.lt_leave_type_id = lr.lr_leave_type_id

            INNER JOIN public.leave_status ls
                ON ls.ls_leave_status_id = lr.lr_status_id

            WHERE manager.pr_id = $1
              AND employee.or_is_active = TRUE

            ORDER BY
                CASE
                    WHEN LOWER(ls.ls_leave_status_name) = 'pending'
                    THEN 0
                    WHEN LOWER(ls.ls_leave_status_name) = 'approved'
                    THEN 1
                    WHEN LOWER(ls.ls_leave_status_name) = 'rejected'
                    THEN 2
                    WHEN LOWER(ls.ls_leave_status_name) = 'cancelled'
                    THEN 3
                    ELSE 4
                END,
                lr.lr_created_at DESC

            LIMIT $2 OFFSET $3
            `,
            [managerPrId, limit, offset]
        );

        return paginatedResponse(
            res,
            200,
            result.rows,
            page,
            limit,
            total
        );

    } catch (error) {
        return handleDbError(res, error);
    }
};

module.exports.getLoggedInPrId = getLoggedInPrId;
module.exports.calculateTotalDays = calculateTotalDays;
module.exports.validateYear = validateYear;