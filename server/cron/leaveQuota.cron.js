const cron = require("node-cron");
const { db } = require("../db/connectDB");

const CARRY_FORWARD_PERCENTAGE = 0.50;

async function syncEmployeeLeaveQuota() {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const currentYear = new Date().getFullYear();

        const employeesResult = await client.query(`
            SELECT
                o.or_id,
                o.Pr_Id,
                o.or_employee_type_id
            FROM public.organizations o
            WHERE o.or_is_active = TRUE
              AND o.Pr_Id IS NOT NULL
              AND o.or_employee_type_id IS NOT NULL
        `);

        for (const employee of employeesResult.rows) {

            const prId = employee.pr_id;
            const employeeTypeId =
                employee.or_employee_type_id;

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
                        OR lt.lt_from_date <=
                           make_date($2, 12, 31)
                  )
                  AND (
                        lt.lt_to_date IS NULL
                        OR lt.lt_to_date >=
                           make_date($2, 1, 1)
                  )
                ORDER BY lt.lt_leave_type_id
                `,
                [
                    employeeTypeId,
                    currentYear
                ]
            );

            for (const leaveType of leaveTypesResult.rows) {

                const existingQuotaResult =
                    await client.query(
                        `
                        SELECT lq_id
                        FROM public.leave_quota
                        WHERE lq_pr_id = $1
                          AND lq_leave_type_id = $2
                          AND lq_leave_year = $3
                        LIMIT 1
                        `,
                        [
                            prId,
                            leaveType.lt_leave_type_id,
                            currentYear
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

                    const previousYear =
                        currentYear - 1;

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

                    if (
                        previousQuotaResult.rows.length > 0
                    ) {

                        const previous =
                            previousQuotaResult.rows[0];

                        const previousAllocated =
                            Number(
                                previous.allocated_days
                            ) || 0;

                        const previousCarry =
                            Number(
                                previous.carry_forward_days
                            ) || 0;

                        const previousUsed =
                            Number(
                                previous.used_days
                            ) || 0;

                        const previousPending =
                            Number(
                                previous.pending_days
                            ) || 0;

                        const previousAvailable =
                            Math.max(
                                previousAllocated +
                                previousCarry -
                                previousUsed -
                                previousPending,
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
                        employeeTypeId,
                        currentYear,
                        allocatedDays,
                        carryForwardDays,
                        prId
                    ]
                );

                console.log(
                    `[LEAVE QUOTA CREATED] ` +
                    `PR=${prId} ` +
                    `TYPE=${leaveType.lt_leave_type_id} ` +
                    `PAID=${isPaid} ` +
                    `ALLOCATED=${allocatedDays} ` +
                    `CARRY=${carryForwardDays}`
                );
            }
        }

        await client.query("COMMIT");

        console.log(
            `[LEAVE QUOTA SYNC] Completed ${new Date().toISOString()}`
        );

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "[LEAVE QUOTA SYNC ERROR]",
            error
        );

    } finally {
        client.release();
    }
}

cron.schedule("*/1 * * * *", async () => {
    console.log("[LEAVE QUOTA SYNC] Running...");
    await syncEmployeeLeaveQuota();
});

module.exports = {
    syncEmployeeLeaveQuota
};