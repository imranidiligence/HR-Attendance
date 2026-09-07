const { db } = require("../db/connectDB");
require("dotenv").config();
const { getDeviceAttendance } = require("../services/zk.service");
const sendEmail = require("../utils/mailer");
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

exports.getAllEmployeesLeaveSummary = async (req, res) => {
    try {
        const year =
            validateYear(req.query.year) ||
            new Date().getFullYear();

        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.max(Number(req.query.limit) || 10, 1);
        const offset = (page - 1) * limit;

        const result = await db.query(
            `
            WITH employee_data AS (
                SELECT
                    o.or_id,
                    o.pr_id,
                    o.or_emp_id,
                    o.or_official_email,
                    o.or_official_contact,
                    o.or_is_active,
                    o.or_employee_type_id,
                    o.or_reporting_location_id,
                    o.or_organization_email,
                    o.or_reporting_to_id,
                    o.or_department_id,
                    o.or_designation_id,
                    o.or_joining_date,
                    o.or_leaving_date,
                    o.or_created_at,
                    o.or_updated_at,
                    o.or_created_by,
                    o.or_updated_by,

                    p.pr_email,
                    p.pr_first_name,
                    p.pr_last_name,
                    p.pr_dob,
                    p.pr_contact,
                    p.pr_gender_id,
                    p.pr_blood_group_id,
                    p.pr_marital_status_id,
                    p.pr_nationality_id,
                    p.pr_profile_image,
                    p.pr_is_active,
                    p.pr_created_at AS personal_created_at,
                    p.pr_updated_at AS personal_updated_at,
                    p.pr_created_by AS personal_created_by,
                    p.pr_updated_by AS personal_updated_by

                FROM public.organizations o

                LEFT JOIN public.personal p
                    ON p.pr_id = o.pr_id

                WHERE o.or_is_active = TRUE
            ),

            quota_summary AS (
                SELECT
                    lq_pr_id AS pr_id,

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

                WHERE lq_leave_year = $1

                GROUP BY lq_pr_id
            ),

            request_summary AS (
                SELECT
                    lr.lr_pr_id AS pr_id,

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
                    ON ls.ls_leave_status_id = lr.lr_status_id

                WHERE EXTRACT(
                    YEAR FROM lr.lr_from_date
                ) = $1

                GROUP BY lr.lr_pr_id
            ),

            unpaid_summary AS (
                SELECT
                    lr.lr_pr_id AS pr_id,

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

                WHERE COALESCE(
                    lt.lt_is_paid,
                    FALSE
                ) = FALSE

                AND EXTRACT(
                    YEAR FROM lr.lr_from_date
                ) = $1

                AND LOWER(
                    ls.ls_leave_status_name
                ) IN (
                    'pending',
                    'approved'
                )

                GROUP BY lr.lr_pr_id
            )

            SELECT
                e.*,

                COALESCE(
                    q.total_allocated_days,
                    0
                ) AS total_allocated_days,

                COALESCE(
                    q.total_carry_forward_days,
                    0
                ) AS total_carry_forward_days,

                COALESCE(
                    q.total_pending_days,
                    0
                ) AS total_pending_days,

                COALESCE(
                    q.total_used_days,
                    0
                ) AS total_used_days,

                GREATEST(
                    COALESCE(
                        q.total_allocated_days,
                        0
                    )
                    +
                    COALESCE(
                        q.total_carry_forward_days,
                        0
                    )
                    -
                    COALESCE(
                        q.total_used_days,
                        0
                    )
                    -
                    COALESCE(
                        q.total_pending_days,
                        0
                    ),
                    0
                ) AS remaining_days,

                COALESCE(
                    r.total_requests,
                    0
                ) AS total_requests,

                COALESCE(
                    r.pending_requests,
                    0
                ) AS pending_requests,

                COALESCE(
                    r.approved_requests,
                    0
                ) AS approved_requests,

                COALESCE(
                    r.rejected_requests,
                    0
                ) AS rejected_requests,

                COALESCE(
                    r.cancelled_requests,
                    0
                ) AS cancelled_requests,

                COALESCE(
                    u.total_unpaid_leave_days,
                    0
                ) AS total_unpaid_leave_days,

                COALESCE(
                    u.total_unpaid_leave_requests,
                    0
                ) AS total_unpaid_leave_requests

            FROM employee_data e

            LEFT JOIN quota_summary q
                ON q.pr_id = e.pr_id

            LEFT JOIN request_summary r
                ON r.pr_id = e.pr_id

            LEFT JOIN unpaid_summary u
                ON u.pr_id = e.pr_id

            ORDER BY
                e.or_id DESC

            LIMIT $2
            OFFSET $3
            `,
            [year, limit, offset]
        );

        const countResult = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM public.organizations
            WHERE or_is_active = TRUE
            `
        );

        const total = Number(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        return successResponse(
            res,
            200,
            {
                year,
                employees: result.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    total_pages: totalPages,
                    has_next_page: page < totalPages,
                    has_previous_page: page > 1
                }
            },
            "Employees leave summary fetched successfully."
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

const calculateTotalDays = (
    fromDate,
    toDate,
    leaveTypeCode
) => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);

    const code = String(
        leaveTypeCode || ""
    )
        .trim()
        .toUpperCase();

    let totalDays = 0;

    for (
        let current = new Date(start);
        current <= end;
        current.setDate(
            current.getDate() + 1
        )
    ) {
        if (
            code === "PL" &&
            current.getDay() === 0
        ) {
            continue;
        }

        totalDays++;
    }

    return totalDays;
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

        const result = await withTransaction(async (client) => {
            const employee = await getEmployee(
                client,
                prId
            );

            const employeeResult = await client.query(
                `
                SELECT
                    o.or_id,
                    o.pr_id,
                    o.or_emp_id,
                    o.or_organization_name,
                    o.or_official_email,
                    o.or_reporting_to_id,
                    o.or_department_id,
                    o.or_designation_id,
                    p.pr_first_name,
                    p.pr_last_name,
                    p.pr_email
                FROM public.organizations o
                LEFT JOIN public.personal p
                    ON p.pr_id = o.pr_id
                WHERE o.pr_id = $1
                  AND o.or_is_active = TRUE
                LIMIT 1
                `,
                [prId]
            );

            if (employeeResult.rows.length === 0) {
                const error = new Error(
                    "Employee organization information not found."
                );

                error.statusCode = 400;
                throw error;
            }

            const employeeDetails =
                employeeResult.rows[0];

            const reportingTo =
                employeeDetails.or_reporting_to_id;

            if (!reportingTo) {
                const error = new Error(
                    "Reporting manager is not assigned to this employee."
                );

                error.statusCode = 400;
                throw error;
            }

            const managerResult = await client.query(
                `
                SELECT
                    o.or_id,
                    o.pr_id,
                    o.or_emp_id,
                    o.or_organization_name,
                    o.or_official_email,
                    p.pr_first_name,
                    p.pr_last_name,
                    p.pr_email
                FROM public.organizations o
                LEFT JOIN public.personal p
                    ON p.pr_id = o.pr_id
                WHERE o.pr_id = $1
                  AND o.or_is_active = TRUE
                LIMIT 1
                `,
                [reportingTo]
            );

            if (managerResult.rows.length === 0) {
                const error = new Error(
                    "Reporting manager details not found."
                );

                error.statusCode = 400;
                throw error;
            }

            const manager =
                managerResult.rows[0];

            if (!manager.or_official_email) {
                const error = new Error(
                    "Reporting manager email is not configured."
                );

                error.statusCode = 400;
                throw error;
            }

            const employeeName = [
                employeeDetails.pr_first_name,
                employeeDetails.pr_last_name
            ]
                .filter(Boolean)
                .join(" ")
                .trim();

            const managerName = [
                manager.pr_first_name,
                manager.pr_last_name
            ]
                .filter(Boolean)
                .join(" ")
                .trim();

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

            const leaveTypeCode =
                String(
                    leaveType.lt_leave_type_code || ""
                )
                    .trim()
                    .toUpperCase();

            const totalDays =
                calculateTotalDays(
                    from_date,
                    to_date,
                    leaveTypeCode
                );

            if (totalDays <= 0) {
                const error = new Error(
                    leaveTypeCode === "PL"
                        ? "Invalid leave duration. PL leave does not count Sundays."
                        : "Invalid leave duration."
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
                            COALESCE(
                                lq_allocated_days,
                                0
                            )
                            +
                            COALESCE(
                                lq_carry_forward_days,
                                0
                            )
                            -
                            COALESCE(
                                lq_used_days,
                                0
                            )
                            -
                            COALESCE(
                                lq_pending_days,
                                0
                            )
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

            const quota =
                quotaResult.rows[0];

            const availableDays =
                Number(quota.available_days) || 0;

            if (leaveTypeCode === "PL") {
                const currentDate = new Date();

                const currentYear =
                    currentDate.getFullYear();

                const currentMonth =
                    currentDate.getMonth() + 1;

                let earnedPLDays = 12;

                if (year === currentYear) {
                    earnedPLDays =
                        Math.min(
                            currentMonth,
                            12
                        );
                }

                if (year < currentYear) {
                    earnedPLDays = 12;
                }

                if (year > currentYear) {
                    earnedPLDays = 0;
                }

                const usedPLDays =
                    Number(
                        quota.lq_used_days
                    ) || 0;

                const pendingPLDays =
                    Number(
                        quota.lq_pending_days
                    ) || 0;

                const utilizedPLDays =
                    usedPLDays +
                    pendingPLDays;

                const remainingEarnedPLDays =
                    Math.max(
                        0,
                        earnedPLDays -
                        utilizedPLDays
                    );

                if (
                    totalDays >
                    remainingEarnedPLDays
                ) {
                    const error =
                        new Error(
                            `PL leave limit exceeded. Currently: ${earnedPLDays} day(s), Already used: ${usedPLDays} day(s), Pending: ${pendingPLDays} day(s), Available: ${remainingEarnedPLDays} day(s), Requested: ${totalDays} day(s).`
                        );

                    error.statusCode = 400;

                    throw error;
                }
            }

            if (
                isPaid &&
                availableDays < totalDays
            ) {
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
                        COALESCE(
                            lq_pending_days,
                            0
                        ) + $1,
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

                employee: {
                    pr_id:
                        employeeDetails.or_pr_id,

                    emp_id:
                        employeeDetails.or_emp_id,

                    name:
                        employeeName ||
                        employeeDetails.or_emp_id ||
                        "Employee",

                    email:
                        employeeDetails.or_official_email ||
                        employeeDetails.pr_email ||
                        null
                },

                reporting_manager: {
                    pr_id:
                        manager.or_pr_id,

                    emp_id:
                        manager.or_emp_id,

                    name:
                        managerName ||
                        manager.or_emp_id ||
                        "Manager",

                    email:
                        manager.or_official_email ||
                        manager.pr_email ||
                        null
                },

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

        try {
            const request =
                result.request;

            const employee =
                result.employee;

            const manager =
                result.reporting_manager;

            if (!manager.email) {
                throw new Error(
                    "Reporting manager email is not configured."
                );
            }

            await sendEmail(
                manager.email,
                `Leave Request - ${employee.emp_id || employee.pr_id}`,
                "leave_request",
                {
                    manager_name:
                        manager.name || "Manager",

                    manager_id:
                        manager.emp_id || manager.pr_id,

                    employee_name:
                        employee.name || "Employee",

                    employee_id:
                        employee.emp_id || employee.pr_id,

                    employee_email:
                        employee.email || "-",

                    leave_request_id:
                        request.lr_leave_request_id,

                    leave_type:
                        result.leave_type.lt_leave_type_name,

                    leave_type_code:
                        result.leave_type.lt_leave_type_code || "-",

                    from_date:
                        request.lr_from_date,

                    to_date:
                        request.lr_to_date,

                    total_days:
                        result.total_days,

                    reason:
                        request.lr_reason ||
                        "No reason provided",

                    status:
                        "Pending",

                    applied_at: (() => {
                        const date =
                            new Date(
                                request.lr_applied_at
                            );

                        const day =
                            String(
                                date.getDate()
                            ).padStart(2, "0");

                        const month =
                            String(
                                date.getMonth() + 1
                            ).padStart(2, "0");

                        const year =
                            date.getFullYear();

                        let hours =
                            date.getHours();

                        const minutes =
                            String(
                                date.getMinutes()
                            ).padStart(2, "0");

                        const amPm =
                            hours >= 12
                                ? "PM"
                                : "AM";

                        hours =
                            hours % 12;

                        hours =
                            hours || 12;

                        hours =
                            String(hours)
                                .padStart(2, "0");

                        return `${day}-${month}-${year} ${hours}:${minutes} ${amPm}`;
                    })()
                }
            );

            await db.query(
                `
                UPDATE public.leave_requests
                SET
                    lr_ismailfromrequester = TRUE
                WHERE lr_leave_request_id = $1
                `,
                [
                    request.lr_leave_request_id
                ]
            );

            console.log(
                `[LEAVE EMAIL SENT] Request=${request.lr_leave_request_id} To=${manager.email}`
            );

        } catch (emailError) {
            console.error(
                `[LEAVE EMAIL ERROR] Request=${result.request.lr_leave_request_id}`,
                emailError
            );
        }

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
            return errorResponse(
                res,
                "Valid leave request ID is required.",
                400
            );
        }

        const result = await withTransaction(async (client) => {
            const cancelledStatusId =
                await getLeaveStatusId(client, "Cancelled");

            const requestResult = await client.query(
                `
                SELECT
                    lr.*,
                    ls.ls_leave_status_name,

                    o.or_id,
                    o.pr_id,
                    o.or_emp_id AS employee_emp_id,
                    o.or_official_email AS employee_official_email,
                    o.or_organization_email AS employee_organization_email,
                    o.or_reporting_to_id,

                    p.pr_email AS employee_personal_email,
                    p.pr_first_name AS employee_first_name,
                    p.pr_last_name AS employee_last_name,

                    manager.pr_id AS manager_pr_id,
                    manager.or_emp_id AS manager_emp_id,
                    manager.or_official_email AS manager_official_email,
                    manager.or_organization_email AS manager_organization_email,

                    manager_personal.pr_email AS manager_personal_email,
                    manager_personal.pr_first_name AS manager_first_name,
                    manager_personal.pr_last_name AS manager_last_name,

                    lt.lt_leave_type_name,
                    lt.lt_leave_type_code

                FROM public.leave_requests lr

                INNER JOIN public.leave_status ls
                    ON ls.ls_leave_status_id = lr.lr_status_id

                INNER JOIN public.organizations o
                    ON o.pr_id = lr.lr_pr_id

                LEFT JOIN public.personal p
                    ON p.pr_id = lr.lr_pr_id

                INNER JOIN public.leave_types lt
                    ON lt.lt_leave_type_id = lr.lr_leave_type_id

                LEFT JOIN public.organizations manager
                    ON manager.or_id = o.or_reporting_to_id
                    AND manager.or_is_active = TRUE

                LEFT JOIN public.personal manager_personal
                    ON manager_personal.pr_id = manager.pr_id

                WHERE lr.lr_leave_request_id = $1
                  AND lr.lr_pr_id = $2

                FOR UPDATE OF lr
                `,
                [
                    requestId,
                    prId
                ]
            );

            if (requestResult.rows.length === 0) {
                const error = new Error(
                    "Leave request not found."
                );

                error.statusCode = 404;
                throw error;
            }

            const leaveRequest = requestResult.rows[0];

            const currentStatus = String(
                leaveRequest.ls_leave_status_name || ""
            ).toLowerCase();

            if (
                currentStatus !== "pending" &&
                currentStatus !== "approved"
            ) {
                const error = new Error(
                    `Leave cannot be cancelled because current status is ${leaveRequest.ls_leave_status_name}.`
                );

                error.statusCode = 400;
                throw error;
            }

            const today = new Date()
                .toISOString()
                .slice(0, 10);

            const fromDate = String(
                leaveRequest.lr_from_date
            ).slice(0, 10);

            if (fromDate <= today) {
                const error = new Error(
                    "Leave cannot be cancelled on or after the leave start date."
                );

                error.statusCode = 400;
                throw error;
            }

            const quotaResult = await client.query(
                `
                SELECT
                    *
                FROM public.leave_quota
                WHERE lq_pr_id = $1
                  AND lq_leave_type_id = $2
                  AND lq_leave_year = EXTRACT(
                      YEAR FROM $3::date
                  )
                FOR UPDATE
                `,
                [
                    prId,
                    leaveRequest.lr_leave_type_id,
                    leaveRequest.lr_from_date
                ]
            );

            if (quotaResult.rows.length === 0) {
                const error = new Error(
                    "Leave quota not found."
                );

                error.statusCode = 400;
                throw error;
            }

            const quota = quotaResult.rows[0];

            const requestedDays = Number(
                leaveRequest.lr_total_days || 0
            );

            const pendingBefore = Number(
                quota.lq_pending_days || 0
            );

            const usedBefore = Number(
                quota.lq_used_days || 0
            );

            let pendingAfter = pendingBefore;
            let usedAfter = usedBefore;

            if (currentStatus === "pending") {
                pendingAfter = Math.max(
                    pendingBefore - requestedDays,
                    0
                );

                await client.query(
                    `
                    UPDATE public.leave_quota
                    SET
                        lq_pending_days = $1,
                        lq_updated_at = CURRENT_TIMESTAMP,
                        lq_updated_by = $2
                    WHERE lq_id = $3
                    `,
                    [
                        pendingAfter,
                        prId,
                        quota.lq_id
                    ]
                );
            }

            if (currentStatus === "approved") {
                usedAfter = Math.max(
                    usedBefore - requestedDays,
                    0
                );

                await client.query(
                    `
                    UPDATE public.leave_quota
                    SET
                        lq_used_days = $1,
                        lq_updated_at = CURRENT_TIMESTAMP,
                        lq_updated_by = $2
                    WHERE lq_id = $3
                    `,
                    [
                        usedAfter,
                        prId,
                        quota.lq_id
                    ]
                );
            }

            const updateResult = await client.query(
                `
                UPDATE public.leave_requests
                SET
                    lr_status_id = $1,
                    lr_cancelled_at = CURRENT_TIMESTAMP,
                    lr_cancellation_reason = $2,
                    lr_updated_at = CURRENT_TIMESTAMP,
                    lr_updated_by = $3
                WHERE lr_leave_request_id = $4
                RETURNING *
                `,
                [
                    cancelledStatusId,
                    reason,
                    prId,
                    requestId
                ]
            );

            const employeeName = [
                leaveRequest.employee_first_name,
                leaveRequest.employee_last_name
            ]
                .filter(Boolean)
                .join(" ")
                .trim();

            const managerName = [
                leaveRequest.manager_first_name,
                leaveRequest.manager_last_name
            ]
                .filter(Boolean)
                .join(" ")
                .trim();

            return {
                request: updateResult.rows[0],

                employee: {
                    name:
                        employeeName ||
                        leaveRequest.employee_emp_id ||
                        "Employee",

                    emp_id:
                        leaveRequest.employee_emp_id,

                    email:
                        leaveRequest.employee_personal_email ||
                        leaveRequest.employee_official_email ||
                        leaveRequest.employee_organization_email ||
                        null
                },

                manager: {
                    name:
                        managerName ||
                        leaveRequest.manager_emp_id ||
                        "Manager",

                    emp_id:
                        leaveRequest.manager_emp_id,

                    email:
                        leaveRequest.manager_official_email ||
                        leaveRequest.manager_organization_email ||
                        leaveRequest.manager_personal_email ||
                        null
                },

                leave_type: {
                    name:
                        leaveRequest.lt_leave_type_name,

                    code:
                        leaveRequest.lt_leave_type_code
                },

                original_status:
                    leaveRequest.ls_leave_status_name,

                quota: {
                    pending_days_before:
                        pendingBefore,

                    pending_days_after:
                        pendingAfter,

                    used_days_before:
                        usedBefore,

                    used_days_after:
                        usedAfter,

                    released_days:
                        requestedDays
                }
            };
        });

        const formatDateTime = (value) => {
            if (!value) {
                return "-";
            }

            const date = new Date(value);

            const day = String(
                date.getDate()
            ).padStart(2, "0");

            const month = String(
                date.getMonth() + 1
            ).padStart(2, "0");

            const year =
                date.getFullYear();

            const hours = String(
                date.getHours()
            ).padStart(2, "0");

            const minutes = String(
                date.getMinutes()
            ).padStart(2, "0");

            return `${day}-${month}-${year}:${hours}:${minutes}`;
        };

        const request = result.request;

        const emailData = {
            employee_name:
                result.employee.name,

            employee_id:
                result.employee.emp_id,

            leave_request_id:
                request.lr_leave_request_id,

            leave_type:
                result.leave_type.name,

            leave_type_code:
                result.leave_type.code || "-",

            from_date:
                request.lr_from_date,

            to_date:
                request.lr_to_date,

            total_days:
                request.lr_total_days,

            original_status:
                result.original_status,

            reason:
                request.lr_reason ||
                "No reason provided",

            cancellation_reason:
                request.lr_cancellation_reason ||
                "No cancellation reason provided",

            status:
                "Cancelled",

            applied_at:
                formatDateTime(
                    request.lr_applied_at
                ),

            cancelled_at:
                formatDateTime(
                    request.lr_cancelled_at
                ),

            pending_days:
                result.quota.pending_days_after,

            used_days:
                result.quota.used_days_after,

            manager_name:
                result.manager.name
        };

        if (result.employee.email) {
            try {
                await sendEmail(
                    result.employee.email,
                    `Leave Request Cancelled - ${request.lr_leave_request_id}`,
                    "leave_cancelled",
                    emailData
                );

                console.log(
                    `[LEAVE CANCELLATION EMAIL SENT] Request=${request.lr_leave_request_id} To=${result.employee.email}`
                );
            } catch (emailError) {
                console.error(
                    `[LEAVE CANCELLATION EMAIL ERROR] Request=${request.lr_leave_request_id} To=${result.employee.email}`,
                    emailError
                );
            }
        }

        if (result.manager.email) {
            try {
                await sendEmail(
                    result.manager.email,
                    `Leave Request Cancelled - ${request.lr_leave_request_id}`,
                    "leave_cancelled",
                    emailData
                );

                console.log(
                    `[LEAVE CANCELLATION MANAGER EMAIL SENT] Request=${request.lr_leave_request_id} To=${result.manager.email}`
                );
            } catch (emailError) {
                console.error(
                    `[LEAVE CANCELLATION MANAGER EMAIL ERROR] Request=${request.lr_leave_request_id} To=${result.manager.email}`,
                    emailError
                );
            }
        }

        return successResponse(
            res,
            200,
            result,
            "Leave cancelled successfully."
        );

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
            return errorResponse(
                res,
                "Valid leave request ID is required.",
                400
            );
        }

        if (!approverPrId) {
            return errorResponse(
                res,
                "Unable to identify logged-in approver.",
                401
            );
        }

        const result = await withTransaction(async (client) => {
            const approvedStatusId =
                await getLeaveStatusId(client, "Approved");

            const requestResult = await client.query(
                `
                SELECT
                    lr.*,
                    ls.ls_leave_status_name,

                    employee.or_id AS employee_or_id,
                    employee.pr_id AS employee_pr_id,
                    employee.or_emp_id AS employee_emp_id,
                    employee.or_official_email AS employee_official_email,
                    cm.cpt_name AS employee_organization_name,
                    employee.or_reporting_to_id,

                    employee_personal.pr_first_name AS employee_first_name,
                    employee_personal.pr_last_name AS employee_last_name,
                    employee_personal.pr_email AS employee_personal_email,

                    manager.pr_id AS manager_pr_id,
                    manager.or_emp_id AS manager_emp_id,
                    manager.or_official_email AS manager_official_email,

                    lt.lt_leave_type_name,
                    lt.lt_leave_type_code

                FROM public.leave_requests lr

                INNER JOIN public.leave_status ls
                    ON ls.ls_leave_status_id = lr.lr_status_id

                INNER JOIN public.organizations employee
                    ON employee.pr_id = lr.lr_pr_id

                INNER JOIN public.personal employee_personal
                    ON employee_personal.pr_id = employee.pr_id

                INNER JOIN public.organizations manager
                    ON manager.or_id = employee.or_reporting_to_id

                INNER JOIN public.leave_types lt
                    ON lt.lt_leave_type_id = lr.lr_leave_type_id

                LEFT JOIN companies_master cm
                    ON cm.cpt_id = employee.or_company_id

                WHERE lr.lr_leave_request_id = $1

                FOR UPDATE OF lr
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

            const leaveRequest = requestResult.rows[0];

            if (
                Number(leaveRequest.manager_pr_id) !==
                Number(approverPrId)
            ) {
                const error = new Error(
                    "You are not authorized to approve this leave request."
                );

                error.statusCode = 403;
                throw error;
            }

            const currentStatus =
                String(
                    leaveRequest.ls_leave_status_name || ""
                ).toLowerCase();

            if (currentStatus !== "pending") {
                const error = new Error(
                    `Leave cannot be approved because current status is ${leaveRequest.ls_leave_status_name}.`
                );

                error.statusCode = 400;
                throw error;
            }

            const quotaResult = await client.query(
                `
                SELECT *
                FROM public.leave_quota
                WHERE lq_pr_id = $1
                  AND lq_leave_type_id = $2
                  AND lq_leave_year =
                      EXTRACT(YEAR FROM $3::date)
                FOR UPDATE
                `,
                [
                    leaveRequest.lr_pr_id,
                    leaveRequest.lr_leave_type_id,
                    leaveRequest.lr_from_date
                ]
            );

            if (quotaResult.rows.length === 0) {
                const error = new Error(
                    "Leave quota not found."
                );

                error.statusCode = 400;
                throw error;
            }

            const quota = quotaResult.rows[0];

            const pendingDays =
                Number(quota.lq_pending_days || 0);

            const requestedDays =
                Number(leaveRequest.lr_total_days || 0);

            if (requestedDays <= 0) {
                const error = new Error(
                    "Invalid leave request days."
                );

                error.statusCode = 400;
                throw error;
            }

            if (pendingDays < requestedDays) {
                const error = new Error(
                    "Invalid quota state. Pending leave balance is insufficient."
                );

                error.statusCode = 409;
                throw error;
            }

            const usedDaysBefore =
                Number(quota.lq_used_days || 0);

            const pendingDaysAfter =
                pendingDays - requestedDays;

            const usedDaysAfter =
                usedDaysBefore + requestedDays;

            await client.query(
                `
                UPDATE public.leave_quota
                SET
                    lq_pending_days = $1,
                    lq_used_days = $2,
                    lq_updated_at = CURRENT_TIMESTAMP,
                    lq_updated_by = $3
                WHERE lq_id = $4
                `,
                [
                    pendingDaysAfter,
                    usedDaysAfter,
                    approverPrId,
                    quota.lq_id
                ]
            );

            const requestNumber =
                Number(leaveRequest.lr_leave_request_id);

            const requestDate =
                leaveRequest.lr_applied_at
                    ? new Date(leaveRequest.lr_applied_at)
                    : new Date();

            const day =
                String(requestDate.getDate()).padStart(2, "0");

            const month =
                String(requestDate.getMonth() + 1).padStart(2, "0");

            const year =
                requestDate.getFullYear();

            const generatedRequestId =
                `${day}${month}${year}${String(requestNumber).padStart(2, "0")}`;

            const updateResult = await client.query(
                `
                UPDATE public.leave_requests
                SET
                    request_id = COALESCE(request_id, $1),
                    lr_status_id = $2,
                    lr_approver_by = $3,
                    lr_approver_at = CURRENT_TIMESTAMP,
                    lr_approver_remark = $4,
                    lr_ismailfromapprover = FALSE,
                    lr_updated_at = CURRENT_TIMESTAMP,
                    lr_updated_by = $3
                WHERE lr_leave_request_id = $5
                RETURNING *
                `,
                [
                    generatedRequestId,
                    approvedStatusId,
                    approverPrId,
                    remark,
                    requestId
                ]
            );

            const employeeName = [
                leaveRequest.employee_first_name,
                leaveRequest.employee_last_name
            ]
                .filter(Boolean)
                .join(" ")
                .trim();

            const employeeEmail =
                leaveRequest.employee_personal_email ||
                leaveRequest.employee_official_email ||
                null;

            return {
                request: updateResult.rows[0],

                employee: {
                    pr_id: leaveRequest.employee_pr_id,
                    emp_id: leaveRequest.employee_emp_id,
                    name:
                        employeeName ||
                        leaveRequest.employee_emp_id ||
                        "Employee",
                    email: employeeEmail
                },

                manager: {
                    pr_id: leaveRequest.manager_pr_id,
                    emp_id: leaveRequest.manager_emp_id,
                    email: leaveRequest.manager_official_email
                },

                leave_type: {
                    name: leaveRequest.lt_leave_type_name,
                    code: leaveRequest.lt_leave_type_code
                },

                quota: {
                    lq_id: quota.lq_id,
                    pending_days_before: pendingDays,
                    pending_days_after: pendingDaysAfter,
                    used_days_before: usedDaysBefore,
                    used_days_after: usedDaysAfter
                }
            };
        });

        try {
            if (result.employee.email) {
                const request = result.request;

                const formattedAppliedAt =
                    request.lr_applied_at
                        ? new Date(
                            request.lr_applied_at
                        ).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                        })
                            .replace(",", ":")
                            .replace(" ", "")
                            .replace(
                                /^(\d{2})\/(\d{2})\/(\d{4}):/,
                                "$2-$1-$3:"
                            )
                        : "-";

                const formattedApprovedAt =
                    request.lr_approver_at
                        ? new Date(
                            request.lr_approver_at
                        ).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false
                        })
                            .replace(",", ":")
                            .replace(" ", "")
                            .replace(
                                /^(\d{2})\/(\d{2})\/(\d{4}):/,
                                "$2-$1-$3:"
                            )
                        : "-";

                await sendEmail(
                    result.employee.email,
                    `Leave Request Approved - ${request.request_id || request.lr_leave_request_id}`,
                    "leave_approved",
                    {
                        employee_name:
                            result.employee.name,

                        employee_id:
                            result.employee.emp_id,

                        leave_request_id:
                            request.request_id ||
                            request.lr_leave_request_id,

                        leave_type:
                            result.leave_type.name,

                        leave_type_code:
                            result.leave_type.code || "-",

                        from_date:
                            request.lr_from_date,

                        to_date:
                            request.lr_to_date,

                        total_days:
                            request.lr_total_days,

                        reason:
                            request.lr_reason ||
                            "No reason provided",

                        status:
                            "Approved",

                        applied_at:
                            formattedAppliedAt,

                        approved_at:
                            formattedApprovedAt,

                        approver_remark:
                            result.request.lr_approver_remark ||
                            "No remark provided",

                        used_days:
                            result.quota.used_days_after,

                        pending_days:
                            result.quota.pending_days_after
                    }
                );

                await db.query(
                    `
                    UPDATE public.leave_requests
                    SET
                        lr_ismailfromapprover = TRUE,
                        lr_updated_at = CURRENT_TIMESTAMP,
                        lr_updated_by = $1
                    WHERE lr_leave_request_id = $2
                    `,
                    [
                        approverPrId,
                        request.lr_leave_request_id
                    ]
                );

                console.log(
                    `[LEAVE APPROVAL EMAIL SENT] Request=${request.request_id || request.lr_leave_request_id} To=${result.employee.email}`
                );
            }
        } catch (emailError) {
            console.error(
                `[LEAVE APPROVAL EMAIL ERROR] Request=${result.request.request_id || result.request.lr_leave_request_id}`,
                emailError
            );
        }

        return successResponse(
            res,
            200,
            result,
            "Leave approved successfully."
        );

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
            return errorResponse(
                res,
                "Valid leave request ID is required.",
                400
            );
        }

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
                "From date cannot be greater than to date.",
                400
            );
        }

        const fromYear = Number(from_date.substring(0, 4));
        const toYear = Number(to_date.substring(0, 4));

        if (fromYear !== toYear) {
            return errorResponse(
                res,
                "Leave dates must belong to the same year.",
                400
            );
        }

        const result = await withTransaction(async (client) => {
            const pendingStatusId =
                await getLeaveStatusId(client, "Pending");

            const requestResult = await client.query(
                `
                SELECT
                    lr.*,
                    ls.ls_leave_status_name,

                    lt.lt_leave_type_name,
                    lt.lt_leave_type_code,
                    lt.lt_is_paid,
                    lt.lt_emptype,

                    employee.pr_id AS employee_pr_id,
                    employee.or_emp_id AS employee_emp_id,
                    employee.or_official_email AS employee_official_email,
                    employee.or_reporting_to_id,

                    employee_personal.pr_first_name AS employee_first_name,
                    employee_personal.pr_last_name AS employee_last_name,
                    employee_personal.pr_email AS employee_personal_email,

                    manager.pr_id AS manager_pr_id,
                    manager.or_emp_id AS manager_emp_id,
                    manager.or_official_email AS manager_official_email,

                    manager_personal.pr_first_name AS manager_first_name,
                    manager_personal.pr_last_name AS manager_last_name,
                    manager_personal.pr_email AS manager_personal_email

                FROM public.leave_requests lr

                INNER JOIN public.leave_status ls
                    ON ls.ls_leave_status_id = lr.lr_status_id

                INNER JOIN public.leave_types lt
                    ON lt.lt_leave_type_id = lr.lr_leave_type_id

                INNER JOIN public.organizations employee
                    ON employee.pr_id = lr.lr_pr_id

                INNER JOIN public.personal employee_personal
                    ON employee_personal.pr_id = employee.pr_id

                LEFT JOIN public.organizations manager
                    ON manager.or_id = employee.or_reporting_to_id
                    AND manager.or_is_active = TRUE

                LEFT JOIN public.personal manager_personal
                    ON manager_personal.pr_id = manager.pr_id

                WHERE lr.lr_leave_request_id = $1

                FOR UPDATE OF lr
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

            if (
                Number(oldRequest.lr_pr_id) !==
                Number(prId)
            ) {
                const error = new Error(
                    "You are not authorized to edit this leave request."
                );

                error.statusCode = 403;
                throw error;
            }

            const currentStatus =
                String(
                    oldRequest.ls_leave_status_name || ""
                )
                    .trim()
                    .toLowerCase();

            const editableStatuses = [
                "pending",
                "approved",
                "rejected",
                "cancelled"
            ];

            if (
                !editableStatuses.includes(currentStatus)
            ) {
                const error = new Error(
                    `Leave cannot be edited because current status is ${oldRequest.ls_leave_status_name}.`
                );

                error.statusCode = 400;
                throw error;
            }

            const employeeResult = await client.query(
                `
                SELECT
                    o.pr_id,
                    o.or_emp_id,
                    o.or_official_email,
                    o.or_reporting_to_id,

                    CONCAT_WS(
                        ' ',
                        p.pr_first_name,
                        p.pr_last_name
                    ) AS employee_name,

                    p.pr_email AS employee_email

                FROM public.organizations o

                INNER JOIN public.personal p
                    ON p.pr_id = o.pr_id

                WHERE o.pr_id = $1
                  AND o.or_is_active = TRUE

                LIMIT 1
                `,
                [prId]
            );

            if (employeeResult.rows.length === 0) {
                const error = new Error(
                    "Employee organization information not found."
                );

                error.statusCode = 400;
                throw error;
            }

            const employee = employeeResult.rows[0];

            if (!employee.or_reporting_to_id) {
                const error = new Error(
                    "Reporting manager is not assigned to this employee."
                );

                error.statusCode = 400;
                throw error;
            }

            const managerResult = await client.query(
                `
                SELECT
                    o.pr_id,
                    o.or_emp_id,
                    o.or_official_email,

                    CONCAT_WS(
                        ' ',
                        p.pr_first_name,
                        p.pr_last_name
                    ) AS manager_name,

                    p.pr_email AS manager_email

                FROM public.organizations o

                INNER JOIN public.personal p
                    ON p.pr_id = o.pr_id

                WHERE o.or_id = $1
                  AND o.or_is_active = TRUE

                LIMIT 1
                `,
                [
                    employee.or_reporting_to_id
                ]
            );

            if (managerResult.rows.length === 0) {
                const error = new Error(
                    "Reporting manager information not found."
                );

                error.statusCode = 400;
                throw error;
            }

            const manager = managerResult.rows[0];

            const managerEmail =
                manager.manager_email ||
                manager.or_official_email ||
                null;

            if (!managerEmail) {
                const error = new Error(
                    "Reporting manager email is not configured."
                );

                error.statusCode = 400;
                throw error;
            }

            const newLeaveType =
                await getApplicableLeaveType(
                    client,
                    prId,
                    leaveTypeId,
                    from_date,
                    to_date
                );

            if (!newLeaveType) {
                const error = new Error(
                    "Invalid or inactive leave type."
                );

                error.statusCode = 400;
                throw error;
            }

            const newLeaveTypeCode =
                String(
                    newLeaveType.lt_leave_type_code || ""
                )
                    .trim()
                    .toUpperCase();

            const requestedDays =
                calculateTotalDays(
                    from_date,
                    to_date,
                    newLeaveTypeCode
                );

            if (!requestedDays || requestedDays <= 0) {
                const error = new Error(
                    newLeaveTypeCode === "PL"
                        ? "Invalid leave duration. PL leave does not count Sundays."
                        : "Invalid leave duration."
                );

                error.statusCode = 400;
                throw error;
            }

            const oldLeaveTypeId =
                Number(oldRequest.lr_leave_type_id);

            const newLeaveTypeId =
                Number(leaveTypeId);

            const oldDays =
                Number(oldRequest.lr_total_days || 0);

            const oldYear =
                Number(
                    String(
                        oldRequest.lr_from_date
                    ).substring(0, 4)
                );

            const newYear = fromYear;

            const oldConsumesQuota =
                currentStatus === "pending" ||
                currentStatus === "approved";

            const sameLeaveType =
                oldLeaveTypeId === newLeaveTypeId;

            const sameLeaveYear =
                oldYear === newYear;

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
                    ON ls.ls_leave_status_id =
                       lr.lr_status_id

                WHERE lr.lr_pr_id = $1
                  AND lr.lr_leave_request_id <> $2
                  AND lr.lr_leave_type_id = $3

                  AND LOWER(
                      ls.ls_leave_status_name
                  ) IN (
                      'pending',
                      'approved'
                  )

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
                    oldYear
                ]
            );

            const oldQuota =
                oldQuotaResult.rows.length > 0
                    ? oldQuotaResult.rows[0]
                    : null;

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
                    newYear
                ]
            );

            const newQuota =
                newQuotaResult.rows.length > 0
                    ? newQuotaResult.rows[0]
                    : null;

            if (newLeaveTypeCode === "PL") {
                if (!newQuota) {
                    const error = new Error(
                        "PL leave quota not found."
                    );

                    error.statusCode = 400;
                    throw error;
                }

                const currentDate = new Date();
                const currentYear =
                    currentDate.getFullYear();

                const currentMonth =
                    currentDate.getMonth() + 1;

                let earnedPLDays = 12;

                if (newYear === currentYear) {
                    earnedPLDays =
                        Math.min(
                            currentMonth,
                            12
                        );
                }

                if (newYear < currentYear) {
                    earnedPLDays = 12;
                }

                if (newYear > currentYear) {
                    earnedPLDays = 0;
                }

                let usedPLDays =
                    Number(
                        newQuota.lq_used_days || 0
                    );

                let pendingPLDays =
                    Number(
                        newQuota.lq_pending_days || 0
                    );

                if (
                    oldConsumesQuota &&
                    sameLeaveType &&
                    sameLeaveYear
                ) {
                    if (currentStatus === "approved") {
                        usedPLDays =
                            Math.max(
                                0,
                                usedPLDays - oldDays
                            );
                    }

                    if (currentStatus === "pending") {
                        pendingPLDays =
                            Math.max(
                                0,
                                pendingPLDays - oldDays
                            );
                    }
                }

                const remainingEarnedPLDays =
                    Math.max(
                        0,
                        earnedPLDays -
                        usedPLDays -
                        pendingPLDays
                    );

                if (
                    requestedDays >
                    remainingEarnedPLDays
                ) {
                    const error = new Error(
                        `PL leave limit exceeded. Currently: ${earnedPLDays} day(s), Already used: ${usedPLDays} day(s), Pending: ${pendingPLDays} day(s), Available: ${remainingEarnedPLDays} day(s), Requested: ${requestedDays} day(s).`
                    );

                    error.statusCode = 400;
                    throw error;
                }
            }

            if (newLeaveType.lt_is_paid === true) {
                if (!newQuota) {
                    const error = new Error(
                        "Leave quota not found for the selected leave type."
                    );

                    error.statusCode = 400;
                    throw error;
                }

                let usedDays =
                    Number(
                        newQuota.lq_used_days || 0
                    );

                let pendingDays =
                    Number(
                        newQuota.lq_pending_days || 0
                    );

                const allocatedDays =
                    Number(
                        newQuota.lq_allocated_days || 0
                    );

                const carryForwardDays =
                    Number(
                        newQuota.lq_carry_forward_days || 0
                    );

                if (
                    oldConsumesQuota &&
                    sameLeaveType &&
                    sameLeaveYear
                ) {
                    if (currentStatus === "approved") {
                        usedDays =
                            Math.max(
                                0,
                                usedDays - oldDays
                            );
                    }

                    if (currentStatus === "pending") {
                        pendingDays =
                            Math.max(
                                0,
                                pendingDays - oldDays
                            );
                    }
                }

                const availableDays =
                    allocatedDays +
                    carryForwardDays -
                    usedDays -
                    pendingDays;

                if (
                    availableDays <
                    requestedDays
                ) {
                    const error = new Error(
                        `Insufficient leave balance. Available: ${availableDays}, Requested: ${requestedDays}. Use Unpaid Quota.`
                    );

                    error.statusCode = 400;
                    throw error;
                }
            }

            if (
                oldConsumesQuota &&
                oldQuota
            ) {
                if (currentStatus === "pending") {
                    await client.query(
                        `
                        UPDATE public.leave_quota
                        SET
                            lq_pending_days =
                                GREATEST(
                                    COALESCE(
                                        lq_pending_days,
                                        0
                                    ) - $1,
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
                                    COALESCE(
                                        lq_used_days,
                                        0
                                    ) - $1,
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

           // if (newLeaveType.lt_is_paid === true) 
                {
                if (!newQuota) {
                    const error = new Error(
                        "Leave quota not found for the selected leave type."
                    );

                    error.statusCode = 400;
                    throw error;
                }

                await client.query(
                    `
                    UPDATE public.leave_quota
                    SET
                        lq_pending_days =
                            COALESCE(
                                lq_pending_days,
                                0
                            ) + $1,
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
                    lr_status_id = $6,
                    lr_reporting_to = $7,
                    lr_approver_by = NULL,
                    lr_approver_at = NULL,
                    lr_approver_remark = NULL,
                    lr_ismailfromapprover = FALSE,
                    lr_updated_at = CURRENT_TIMESTAMP,
                    lr_updated_by = $8
                WHERE lr_leave_request_id = $9
                RETURNING *
                `,
                [
                    newLeaveTypeId,
                    from_date,
                    to_date,
                    requestedDays,
                    reason || null,
                    pendingStatusId,
                    employee.or_reporting_to_id,
                    prId,
                    requestId
                ]
            );

            return {
                request:
                    updateResult.rows[0],

                employee: {
                    pr_id:
                        employee.pr_id,

                    name:
                        employee.employee_name ||
                        employee.or_emp_id ||
                        "Employee",

                    emp_id:
                        employee.or_emp_id,

                    email:
                        employee.employee_email ||
                        employee.or_official_email ||
                        null
                },

                manager: {
                    pr_id:
                        manager.pr_id,

                    emp_id:
                        manager.or_emp_id,

                    name:
                        manager.manager_name ||
                        manager.or_emp_id ||
                        "Manager",

                    email:
                        manager.manager_email ||
                        manager.or_official_email ||
                        null
                },

                leave_type: {
                    name:
                        newLeaveType.lt_leave_type_name,

                    code:
                        newLeaveType.lt_leave_type_code ||
                        "-"
                },

                previous_status:
                    oldRequest.ls_leave_status_name,

                new_status:
                    "Pending",

                previous_leave_type_id:
                    oldLeaveTypeId,

                new_leave_type_id:
                    newLeaveTypeId,

                previous_days:
                    oldDays,

                new_days:
                    requestedDays,

                quota_status:
                    "Quota updated successfully"
            };
        });

        try {
            const request = result.request;

            const formatDateTime = (value) => {
                if (!value) {
                    return "-";
                }

                const date = new Date(value);

                const day =
                    String(
                        date.getDate()
                    ).padStart(2, "0");

                const month =
                    String(
                        date.getMonth() + 1
                    ).padStart(2, "0");

                const year =
                    date.getFullYear();

                const hours =
                    String(
                        date.getHours()
                    ).padStart(2, "0");

                const minutes =
                    String(
                        date.getMinutes()
                    ).padStart(2, "0");

                return `${day}-${month}-${year}:${hours}:${minutes}`;
            };

            if (
                result.manager &&
                result.manager.email
            ) {
                await sendEmail(
                    result.manager.email,
                    `Leave Request Updated - ${request.lr_leave_request_id}`,
                    "leave_request_edit",
                    {
                        manager_name:
                            result.manager.name,

                        employee_name:
                            result.employee.name,

                        employee_id:
                            result.employee.emp_id,

                        employee_email:
                            result.employee.email || "-",

                        leave_request_id:
                            request.lr_leave_request_id,

                        leave_type:
                            result.leave_type.name,

                        leave_type_code:
                            result.leave_type.code,

                        from_date:
                            request.lr_from_date,

                        to_date:
                            request.lr_to_date,

                        total_days:
                            request.lr_total_days,

                        reason:
                            request.lr_reason ||
                            "No reason provided",

                        previous_status:
                            result.previous_status,

                        status:
                            "Pending",

                        applied_at:
                            formatDateTime(
                                request.lr_applied_at
                            ),

                        updated_at:
                            formatDateTime(
                                request.lr_updated_at
                            )
                    }
                );

                await db.query(
                    `
                    UPDATE public.leave_requests
                    SET
                        lr_ismailfromrequester = TRUE,
                        lr_updated_at = CURRENT_TIMESTAMP,
                        lr_updated_by = $1
                    WHERE lr_leave_request_id = $2
                    `,
                    [
                        prId,
                        request.lr_leave_request_id
                    ]
                );

                console.log(
                    `[LEAVE EDIT EMAIL SENT] Request=${request.lr_leave_request_id} To=${result.manager.email}`
                );
            }
        } catch (emailError) {
            console.error(
                `[LEAVE EDIT EMAIL ERROR] Request=${result.request.lr_leave_request_id}`,
                emailError
            );
        }

        return successResponse(
            res,
            200,
            result,
            "Leave request edited successfully and sent for approval again."
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
        return errorResponse(
            res,
            "Valid leave request ID is required.",
            400
        );
    }

    if (!approverPrId) {
        return errorResponse(
            res,
            "Unable to identify logged-in approver.",
            401
        );
    }

    const result = await withTransaction(async (client) => {
        const rejectedStatusId =
            await getLeaveStatusId(client, "Rejected");

        const requestResult = await client.query(
            `
            SELECT
                lr.*,
                ls.ls_leave_status_name,

                employee.or_id AS employee_or_id,
                employee.pr_id AS employee_pr_id,
                employee.or_emp_id AS employee_emp_id,
                employee.or_official_email AS employee_official_email,
                cm.cpt_name AS employee_organization_name,
                employee.or_reporting_to_id,

                employee_personal.pr_first_name AS employee_first_name,
                employee_personal.pr_last_name AS employee_last_name,
                employee_personal.pr_email AS employee_personal_email,

                manager.pr_id AS manager_pr_id,
                manager.or_emp_id AS manager_emp_id,
                manager.or_official_email AS manager_official_email,

                lt.lt_leave_type_name,
                lt.lt_leave_type_code

            FROM public.leave_requests lr

            INNER JOIN public.leave_status ls
                ON ls.ls_leave_status_id = lr.lr_status_id

            INNER JOIN public.organizations employee
                ON employee.pr_id = lr.lr_pr_id

            INNER JOIN public.personal employee_personal
                ON employee_personal.pr_id = employee.pr_id

            INNER JOIN public.organizations manager
                ON manager.or_id = employee.or_reporting_to_id

            INNER JOIN public.leave_types lt
                ON lt.lt_leave_type_id = lr.lr_leave_type_id

                 Left join companies_master cm
            ON cm.cpt_id = employee.or_company_id

            WHERE lr.lr_leave_request_id = $1

            FOR UPDATE OF lr
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

        const leaveRequest = requestResult.rows[0];

        if (
            Number(leaveRequest.manager_pr_id) !==
            Number(approverPrId)
        ) {
            const error = new Error(
                "You are not authorized to reject this leave request."
            );

            error.statusCode = 403;
            throw error;
        }

        const currentStatus =
            String(
                leaveRequest.ls_leave_status_name || ""
            ).toLowerCase();

        if (currentStatus !== "pending") {
            const error = new Error(
                `Leave cannot be rejected because current status is ${leaveRequest.ls_leave_status_name}.`
            );

            error.statusCode = 400;
            throw error;
        }

        const quotaResult = await client.query(
            `
            SELECT
                lq_id,
                lq_pr_id,
                lq_leave_type_id,
                lq_leave_year,
                lq_allocated_days,
                lq_carry_forward_days,
                lq_used_days,
                lq_pending_days
            FROM public.leave_quota
            WHERE lq_pr_id = $1
              AND lq_leave_type_id = $2
              AND lq_leave_year =
                  EXTRACT(YEAR FROM $3::date)
            FOR UPDATE
            `,
            [
                leaveRequest.lr_pr_id,
                leaveRequest.lr_leave_type_id,
                leaveRequest.lr_from_date
            ]
        );

        if (quotaResult.rows.length === 0) {
            const error = new Error(
                "Leave quota not found."
            );

            error.statusCode = 400;
            throw error;
        }

        const quota = quotaResult.rows[0];

        const pendingDays =
            Number(quota.lq_pending_days || 0);

        const requestedDays =
            Number(leaveRequest.lr_total_days || 0);

        if (requestedDays <= 0) {
            const error = new Error(
                "Invalid leave request days."
            );

            error.statusCode = 400;
            throw error;
        }

        if (pendingDays < requestedDays) {
            const error = new Error(
                "Invalid quota state. Pending leave balance is insufficient."
            );

            error.statusCode = 409;
            throw error;
        }

        const pendingDaysAfter =
            pendingDays - requestedDays;

        const usedDays =
            Number(quota.lq_used_days || 0);

        await client.query(
            `
            UPDATE public.leave_quota
            SET
                lq_pending_days = $1,
                lq_updated_at = CURRENT_TIMESTAMP,
                lq_updated_by = $2
            WHERE lq_id = $3
            `,
            [
                pendingDaysAfter,
                approverPrId,
                quota.lq_id
            ]
        );

        const updateResult = await client.query(
            `
            UPDATE public.leave_requests
            SET
                lr_status_id = $1,
                lr_approver_by = $2,
                lr_approver_at = CURRENT_TIMESTAMP,
                lr_approver_remark = $3,
                lr_ismailfromapprover = FALSE,
                lr_updated_at = CURRENT_TIMESTAMP,
                lr_updated_by = $2
            WHERE lr_leave_request_id = $4
            RETURNING *
            `,
            [
                rejectedStatusId,
                approverPrId,
                remark,
                requestId
            ]
        );

        const employeeName = [
            leaveRequest.employee_first_name,
            leaveRequest.employee_last_name
        ]
            .filter(Boolean)
            .join(" ")
            .trim();

        const employeeEmail =
            leaveRequest.employee_personal_email ||
            leaveRequest.employee_official_email ||
            null;

        return {
            request: updateResult.rows[0],

            employee: {
                pr_id: leaveRequest.employee_pr_id,
                emp_id: leaveRequest.employee_emp_id,
                name:
                    employeeName ||
                    leaveRequest.employee_emp_id ||
                    "Employee",
                email: employeeEmail
            },

            manager: {
                pr_id: leaveRequest.manager_pr_id,
                emp_id: leaveRequest.manager_emp_id,
                email: leaveRequest.manager_official_email
            },

            leave_type: {
                name: leaveRequest.lt_leave_type_name,
                code: leaveRequest.lt_leave_type_code
            },

            quota: {
                lq_id: quota.lq_id,
                pending_days_before: pendingDays,
                pending_days_after: pendingDaysAfter,
                used_days: usedDays,
                released_days: requestedDays
            }
        };
    });

    try {
        if (result.employee.email) {
            const request = result.request;

            const formatDateTime = (value) => {
                if (!value) {
                    return "-";
                }

                const date = new Date(value);

                const day = String(
                    date.getDate()
                ).padStart(2, "0");

                const month = String(
                    date.getMonth() + 1
                ).padStart(2, "0");

                const year =
                    date.getFullYear();

                const hours = String(
                    date.getHours()
                ).padStart(2, "0");

                const minutes = String(
                    date.getMinutes()
                ).padStart(2, "0");

                return `${day}-${month}-${year}:${hours}:${minutes}`;
            };

            await sendEmail(
                result.employee.email,
                `Leave Request Rejected - ${request.lr_leave_request_id}`,
                "leave_rejected",
                {
                    employee_name:
                        result.employee.name,

                    employee_id:
                        result.employee.emp_id,

                    leave_request_id:
                        request.lr_leave_request_id,

                    leave_type:
                        result.leave_type.name,

                    leave_type_code:
                        result.leave_type.code || "-",

                    from_date:
                        request.lr_from_date,

                    to_date:
                        request.lr_to_date,

                    total_days:
                        request.lr_total_days,

                    reason:
                        request.lr_reason ||
                        "No reason provided",

                    status:
                        "Rejected",

                    applied_at:
                        formatDateTime(
                            request.lr_applied_at
                        ),

                    rejected_at:
                        formatDateTime(
                            request.lr_approver_at
                        ),

                    approver_remark:
                        request.lr_approver_remark ||
                        "No remark provided",

                    pending_days:
                        result.quota.pending_days_after,

                    used_days:
                        result.quota.used_days
                }
            );

            await db.query(
                `
                UPDATE public.leave_requests
                SET
                    lr_ismailfromapprover = TRUE,
                    lr_updated_at = CURRENT_TIMESTAMP,
                    lr_updated_by = $1
                WHERE lr_leave_request_id = $2
                `,
                [
                    approverPrId,
                    request.lr_leave_request_id
                ]
            );

            console.log(
                `[LEAVE REJECTION EMAIL SENT] Request=${request.lr_leave_request_id} To=${result.employee.email}`
            );
        }
    } catch (emailError) {
        console.error(
            `[LEAVE REJECTION EMAIL ERROR] Request=${result.request.lr_leave_request_id}`,
            emailError
        );
    }

    return successResponse(
        res,
        200,
        result,
        "Leave rejected successfully."
    );

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