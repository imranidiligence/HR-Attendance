const express = require("express");
const router = express.Router();
const controller = require("../controllers/attendance.controller");
const auth = require("../middlewares/authMiddleware");
const { addEmployController } = require("../controllers/attendance.controller");
const { isAdmin } = require("../middlewares/roleMiddleware");
const { db } = require("../db/connectDB");
const uploadProfileImage = require("../middlewares/uploadProfileImage");
const { updateEmployController } = require("../controllers/attendance.controller");

// Admin

router.get("/sync", controller.syncAttendance);


// Today All Employ Attendance
router.get("/today", auth, isAdmin, controller.getTodayOrganizationAttendance);



// Add Employ by Admin

router.post("/add-employee", uploadProfileImage.single("profile"), addEmployController)
router.put("/employee/:id", updateEmployController);

// Admin Attendance 
router.get("/history", auth, isAdmin, controller.getAdminMyAttendance)


// Admin Activity logs
router.get("/activity-log", auth, isAdmin, controller.getActivityLog);

router.get("/activity-log/exports", auth, isAdmin, controller.exportActivityLog);
// New API for all employees
router.get("/today/all", auth, isAdmin, controller.getTodayOrganizationAttendanceAll);


// Express route example
router.patch('/:emp_id/status', auth, isAdmin, async (req, res) => {
  const { emp_id } = req.params;
  const { is_active } = req.body;

  // console.log("is_Active", is_active)
  // console.log("emp_id", emp_id);

  try {
    await db.query(
      'UPDATE users SET is_active = $1 WHERE emp_id = $2',
      [is_active, emp_id]
    );
    res.status(200).send({ message: "Status updated successfully" });
  } catch (error) {
    res.status(500).send({ error: "Failed to update status" });
  }
});


router.get("/all-attendance", auth, async (req, res) => {
  try {
    let { month, year } = req.query;

    /*
     * =========================================================
     * CURRENT DATE
     * =========================================================
     */
    const today = new Date();

    const filterMonth =
      parseInt(month, 10) || today.getMonth() + 1;

    const filterYear =
      parseInt(year, 10) || today.getFullYear();

    /*
     * =========================================================
     * VALIDATE MONTH
     * =========================================================
     */
    if (filterMonth < 1 || filterMonth > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month. Month must be between 1 and 12.",
      });
    }

    /*
     * =========================================================
     * MONTH DATE RANGE
     * =========================================================
     */

    const fromDate =
      `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;

    const nextMonth =
      filterMonth === 12
        ? 1
        : filterMonth + 1;

    const nextMonthYear =
      filterMonth === 12
        ? filterYear + 1
        : filterYear;

    const toDate =
      `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const values = [
      fromDate,
      toDate,
    ];

    console.log("Attendance Date Range:", {
      fromDate,
      toDate,
      filterMonth,
      filterYear,
    });

    /*
     * =========================================================
     * MONTHLY ATTENDANCE QUERY
     * =========================================================
     */
    const query = `
      WITH calendar AS
      (
        SELECT
          generate_series(
            $1::DATE,
            ($2::DATE - INTERVAL '1 day'),
            INTERVAL '1 day'
          )::DATE AS date_only
      ),

      employees AS
      (
        SELECT DISTINCT

          TRIM(o.or_emp_id) AS emp_id,

          COALESCE(
            NULLIF(
              TRIM(p.pr_first_name),
              ''
            ),

            NULLIF(
              TRIM(
                CONCAT_WS(
                  ' ',
                  p.pr_first_name,
                  p.pr_last_name
                )
              ),
              ''
            ),

            '-'
          ) AS name,

          COALESCE(
            dm."DepartmentName",
            '-'
          ) AS department,

          COALESCE(
            o.or_is_active,
            FALSE
          ) AS is_active

        FROM public.organizations o

        INNER JOIN public.personal p
          ON p.pr_id = o.pr_id

        LEFT JOIN public.department_master dm
          ON dm."DepartmentId" =
             o.or_department_id

        WHERE
          o.or_emp_id IS NOT NULL

          AND TRIM(o.or_emp_id) <> ''

          AND COALESCE(
            o.or_is_active,
            FALSE
          ) = TRUE

        ORDER BY
          TRIM(o.or_emp_id)
      )

      SELECT

        e.emp_id,
        e.name,
        e.department,
        e.is_active,

        c.date_only,

        TO_CHAR(
          c.date_only,
          'YYYY-MM-DD'
        ) AS date,

        EXTRACT(
          ISODOW FROM c.date_only
        )::INTEGER AS day_of_week,

        /*
         * Is this date in the future relative to "today" in IST?
         * Computed in SQL, from IST "today", so it's consistent
         * regardless of server timezone.
         */
        (
          c.date_only >
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
        ) AS is_future,

        ma.id AS attendance_id,
        ma.attendance_date,
        ma.punch_in AS first_in,
        ma.punch_out AS last_out,

        COALESCE(
          ROUND(
            EXTRACT(
              EPOCH FROM ma.total_hours
            ) / 3600.0,
            2
          ),
          0.00
        ) AS hours_worked,

        ma.status_id,
        ma.is_late_arrived,

        ast.status_name AS status

      FROM employees e

      CROSS JOIN calendar c

      LEFT JOIN public.monthly_attendance ma

        ON TRIM(
          ma.emp_id
        ) = TRIM(
          e.emp_id
        )

        AND ma.attendance_date =
            c.date_only

      LEFT JOIN public.attendence_status ast

        ON ast.id =
           ma.status_id

        AND COALESCE(
          ast.is_active,
          TRUE
        ) = TRUE

      ORDER BY
        c.date_only,
        e.emp_id;
    `;

    /*
     * =========================================================
     * EXECUTE QUERY
     * =========================================================
     */
    const { rows } = await db.query(
      query,
      values
    );

    /*
     * =========================================================
     * GROUP BY EMPLOYEE
     * =========================================================
     */
    const employeeMap = {};

    rows.forEach((row) => {

      if (!employeeMap[row.emp_id]) {

        employeeMap[row.emp_id] = {
          emp_id:
            row.emp_id,

          name:
            row.name,

          department:
            row.department,

          is_active:
            row.is_active,

          attendance: [],
        };
      }

      employeeMap[row.emp_id].attendance.push({

        date:
          row.date,

        day_of_week:
          row.day_of_week,

        is_future:
          row.is_future === true,

        first_in:
          row.first_in,

        last_out:
          row.last_out,

        hours_worked:
          row.hours_worked,

        status_id:
          row.status_id,

        status:
          row.status,

        is_late_arrived:
          row.is_late_arrived === true,
      });
    });

    /*
     * =========================================================
     * PER-EMPLOYEE SUMMARY
     * =========================================================
     *
     * Rules:
     *
     * - Future dates (is_future === true) are SKIPPED entirely
     *   from every count — they don't count as absent, present,
     *   or anything else, since that data doesn't exist yet.
     *
     * - "Present" AND "Working" both count as present_days.
     *   "Working" means punched in with no punch_out yet, which
     *   in practice only ever appears on today's row (an
     *   in-progress day) — treated as present, not left uncounted.
     *
     * - absent_days counts ONLY "Absent" status, and only for
     *   past/today dates. Holiday and Weekly Off both resolve to
     *   the "Holiday" status upstream, and Leave resolves to its
     *   own "Leave" status — neither is "Absent", so both are
     *   naturally excluded without extra filtering.
     *
     * - leave_days counts "Leave" status days.
     * - holiday_days counts "Holiday" status days (declared
     *   holidays + weekly-offs, since they share one status).
     * - late_mark_days counts is_late_arrived === true days.
     *
     * SATURDAY HALF-DAY PAIRING (unchanged from before):
     * two Half Day Saturdays => 1 present day; unpaired
     * Saturday half day or any non-Saturday half day => 0.5
     * present day.
     * =========================================================
     */
function summarizeAttendance(attendanceList) {
  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;
  let weeklyOffDays = 0;   // ← new
  let lateMarkDays = 0;
  let halfDayCount = 0;
  let saturdayHalfDayCount = 0;

  for (const day of attendanceList) {
    if (day.is_future) {
      continue;
    }

    const statusLower = (day.status || "").toLowerCase().trim();

    if (day.is_late_arrived) {
      lateMarkDays += 1;
    }

    if (statusLower === "present" || statusLower === "working") {
      presentDays += 1;
    } else if (statusLower === "absent") {
      absentDays += 1;
    } else if (statusLower === "leave") {
      leaveDays += 1;
    } else if (statusLower === "holiday") {
      holidayDays += 1;
    } else if (statusLower === "weekly off") {   // ← new
      weeklyOffDays += 1;
    } else if (statusLower === "half day") {
      halfDayCount += 1;

      if (day.day_of_week === 6) {
        saturdayHalfDayCount += 1;
      }
    }
  }

  const saturdayPairedDays = Math.floor(saturdayHalfDayCount / 2);
  const saturdayLeftover = saturdayHalfDayCount % 2;

  presentDays += saturdayPairedDays;

  const nonSaturdayHalfDays = halfDayCount - saturdayHalfDayCount;
  const fractionalHalfDays = nonSaturdayHalfDays + saturdayLeftover;

  const presentDaysTotal =
    presentDays + fractionalHalfDays * 0.5;

  return {
    present_days: Number(presentDaysTotal.toFixed(2)),
    absent_days: absentDays,
    leave_days: leaveDays,
    holiday_days: holidayDays,
    weekly_off_days: weeklyOffDays,   // ← new
    late_mark_days: lateMarkDays,
    half_day_count: halfDayCount,
    saturday_half_day_pairs_applied: saturdayPairedDays,
  };
}

    Object.values(employeeMap).forEach((employee) => {
      employee.summary = summarizeAttendance(employee.attendance);
    });

    const attendance =
      Object.values(employeeMap);

    /*
     * =========================================================
     * RESPONSE
     * =========================================================
     */
    return res.status(200).json({

      success: true,

      month:
        filterMonth,

      year:
        filterYear,

      total_records:
        attendance.length,

      attendance,
    });

  } catch (error) {

    console.error(
      "All Attendance Report Error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Internal Server Error",
    });
  }
});


// router.get("/weekly-attendance", auth, isAdmin, async (req, res) => {
//   try {
//     const { search, page = 1, limit = 10 } = req.query;

//     const pageInt = parseInt(page);
//     const limitInt = parseInt(limit);
//     const offset = (pageInt - 1) * limitInt;

//     const searchTerm = search ? search.trim() : null;
//  const isTimeSearch = searchTerm && searchTerm.includes(":");
//     const now = new Date();
//     const toDate = now.toISOString().split("T")[0];

//     const sevenDaysAgo = new Date(now);
//     sevenDaysAgo.setDate(now.getDate() - 6);
//     const fromDate = sevenDaysAgo.toISOString().split("T")[0];

//     const query = `
// WITH calendar AS (
//   SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
// ),

// employees AS (
//   SELECT emp_id, name, role
//   FROM users
//   WHERE is_active = true
//     AND (
//       $3::text IS NULL
//       OR emp_id::text ILIKE $4
//       OR name ILIKE $4
//     )
//   ORDER BY emp_id
//   OFFSET $5 LIMIT $6
// ),

// attendance AS (
//   SELECT 
//     al.emp_id,
//     al.punch_time::date AS date_only,
//     MIN(al.punch_time) AS first_in,
//     MAX(al.punch_time) AS last_out,

//     ROUND(
//       EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600,
//       2
//     ) AS total_hours,

//     CONCAT(
//       FLOOR(EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600),
//       'h ',
//       FLOOR(
//         MOD(
//           EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))),
//           3600
//         ) / 60
//       ),
//       'm'
//     ) AS total_time

//   FROM attendance_logs al
//   WHERE al.punch_time::date BETWEEN $1 AND $2
//   GROUP BY al.emp_id, date_only
// )

// SELECT 
//   e.emp_id,
//   e.name,
//   e.role,
//   TO_CHAR(c.date_only, 'YYYY-MM-DD') AS date,
//   TO_CHAR(a.first_in, 'HH12:MI AM') AS first_in,
//   TO_CHAR(a.last_out, 'HH12:MI AM') AS last_out,
//   COALESCE(a.total_hours, 0) AS total_hours,
//   a.total_time

// FROM employees e
// CROSS JOIN calendar c
// LEFT JOIN attendance a
//   ON a.emp_id = e.emp_id
//   AND a.date_only = c.date_only

// WHERE (
//   $3::text IS NULL
//   OR e.emp_id::text ILIKE $4
//   OR e.name ILIKE $4
//   OR TO_CHAR(a.first_in,'HH12:MI AM') ILIKE $4
//   OR TO_CHAR(a.last_out,'HH12:MI AM') ILIKE $4
// )

// ORDER BY e.emp_id, c.date_only DESC;
// `;

//     const { rows } = await db.query(query, [
//       fromDate,
//       toDate,
//       searchTerm,
//       searchTerm ? `%${searchTerm}%` : null,
//       offset,
//       limitInt,
//       isTimeSearch,
//       isTimeSearch ? `%${searchTerm}%` : null
//     ]);

//     if (!rows || rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No attendance data found",
//       });
//     }

//     const grouped = {};

//     rows.forEach((row) => {
//       if (!grouped[row.emp_id]) {
//         grouped[row.emp_id] = {
//           emp_id: row.emp_id,
//           name: row.name,
//           role: row.role,
//           attendance: [],
//         };
//       }

//       grouped[row.emp_id].attendance.push({
//         date: row.date,
//         first_in: row.first_in,
//         last_out: row.last_out,
//         total_hours: row.total_hours,
//       });
//     });

//     const countQuery = `
//       SELECT COUNT(*) AS total
//       FROM users
//       WHERE is_active = true
//       AND (
//         $1::text IS NULL
//         OR emp_id::text ILIKE $2
//         OR name ILIKE $2
//       )
//     `;

//     const { rows: countRows } = await db.query(countQuery, [
//       searchTerm,
//       searchTerm ? `%${searchTerm}%` : null,
//     ]);

//     const totalItems = parseInt(countRows[0].total);
//     const totalPages = Math.ceil(totalItems / limitInt);

//     res.status(200).json({
//       success: true,
//       message: "Weekly attendance fetched successfully",
//       date_range: {
//         from: fromDate,
//         to: toDate,
//       },
//       page: pageInt,
//       totalPages,
//       totalItems,
//       data: Object.values(grouped),
//     });
//   } catch (error) {
//     console.error("Attendance API Error:", error);

//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// router.get("/all-attendance", auth, async (req, res) => {
//   try {
//     let { month, year } = req.query;

//     const today = new Date();
//     const filterMonth = parseInt(month) || today.getMonth() + 1;
//     const filterYear = parseInt(year) || today.getFullYear();

//     // console.log("filterMonth",filterMonth);
//     // console.log("filterYear",filterYear);

//     const fromDate = new Date(filterYear, filterMonth - 1, 1)
//       .toISOString()
//       .slice(0, 10);
//     const toDate = new Date(filterYear, filterMonth, 1)
//       .toISOString()
//       .slice(0, 10);

//     // console.log("fromDate",fromDate);
//     // console.log("toDate",toDate);

//     const values = [fromDate, toDate];

//     const query = `
//    WITH calendar AS (
//     SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
// ),
// daily AS (
//     SELECT 
//         u.emp_id,
//         u.name,
//         u.is_active,  
//         p.department,
//         cal.date_only,

//     MIN(al.punch_time) AS first_in,

//     CASE 
//         WHEN COUNT(al.punch_time) > 1 
//         THEN MAX(al.punch_time)
//         ELSE NULL
//     END AS last_out,

//         CASE
//             WHEN hd.holiday_date IS NOT NULL THEN 'Holiday'
//             WHEN MIN(al.punch_time) IS NULL THEN 'Absent'
//             ELSE 'Present'
//         END AS status,

//         COALESCE(
//           ROUND(
//             EXTRACT(
//               EPOCH FROM 
//               MAX(al.punch_time) - MIN(al.punch_time)
//             ) / 3600.0, 
//             2
//           ), 
//           0.00
//         ) AS hours_worked

//     FROM users u
//     CROSS JOIN calendar cal
//     LEFT JOIN attendance_logs al
//         ON al.emp_id = u.emp_id
//         AND (
//             (al.punch_time)::date = cal.date_only
//         )
//     LEFT JOIN personal p
//         ON p.emp_id = u.emp_id
//     LEFT JOIN holidays hd
//         ON hd.holiday_date = cal.date_only
//     GROUP BY 
//         u.emp_id, 
//         u.name, 
//         u.is_active,   
//         p.department, 
//         cal.date_only, 
//         hd.holiday_date
// )
// SELECT 
//     emp_id,
//     name,
//     department,
//     is_active,   
//     JSON_AGG(
//         JSON_BUILD_OBJECT(
//             'date', date_only,
//             'first_in', first_in,
//             'last_out', last_out,
//             'hours_worked', hours_worked,
//             'status', status
//         )
//         ORDER BY date_only
//     ) AS attendance
// FROM daily
// GROUP BY emp_id, name, department, is_active   
// ORDER BY emp_id;
// `;

// //     const query = `
// //     WITH calendar AS (
// //     SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
// // ),
// // daily AS (
// //     SELECT 
// //         u.emp_id,
// //         u.name,
// //         u.is_active,  
// //         p.department,
// //         cal.date_only,

// //         MIN(al.punch_time) AS first_in,

// //         CASE 
// //             WHEN COUNT(al.punch_time) > 1 
// //             THEN MAX(al.punch_time)
// //             ELSE NULL
// //         END AS last_out,

// //         COALESCE(
// //           ROUND(
// //             EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600.0, 
// //             2
// //           ), 
// //           0.00
// //         ) AS hours_worked,

// //         -- Advanced status logic
// //         CASE
// //             -- Holiday
// //             WHEN hd.holiday_date IS NOT NULL THEN 'Holiday'

// //             -- Absent
// //             WHEN MIN(al.punch_time) IS NULL THEN 'Absent'

// //             -- Working: punched in but not punched out, before 10:00 AM
// //             WHEN MIN(al.punch_time) IS NOT NULL
// //                  AND (CASE WHEN COUNT(al.punch_time) > 1 THEN MAX(al.punch_time) ELSE NULL END) IS NULL
// //                  AND MIN(al.punch_time)::time < time '10:00:00' THEN 'Working'

// //             -- Late Coming: punch-in after 9:30 + 30 min buffer
// //             WHEN MIN(al.punch_time) > (cal.date_only + time '09:30:00' + interval '30 minutes') THEN 'Late Coming'

// //             -- Early Go: left before minimum expected hours
// //             WHEN (CASE WHEN COUNT(al.punch_time) > 1 THEN MAX(al.punch_time) ELSE NULL END) IS NOT NULL
// //                  AND ROUND(EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600.0, 2) < 8
// //                  AND (CASE WHEN COUNT(al.punch_time) > 1 THEN MAX(al.punch_time) ELSE NULL END) <
// //                      (MIN(al.punch_time) + interval '7:30 hours' * (CASE WHEN EXTRACT(DOW FROM cal.date_only) = 6 THEN 5.0/8 ELSE 1 END))
// //             THEN 'Early Go'

// //             -- Present: worked enough hours (Saturday 5h, weekday 8h)
// //             WHEN ROUND(EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600.0, 2) >=
// //                  (CASE WHEN EXTRACT(DOW FROM cal.date_only) = 6 THEN 5 ELSE 8 END)
// //             THEN 'Present'

// //             ELSE 'Absent'
// //         END AS status

// //     FROM users u
// //     CROSS JOIN calendar cal
// //     LEFT JOIN attendance_logs al
// //         ON al.emp_id = u.emp_id
// //         AND (al.punch_time::date = cal.date_only)
// //     LEFT JOIN personal p
// //         ON p.emp_id = u.emp_id
// //     LEFT JOIN holidays hd
// //         ON hd.holiday_date = cal.date_only

// //     GROUP BY 
// //         u.emp_id, 
// //         u.name, 
// //         u.is_active,   
// //         p.department, 
// //         cal.date_only, 
// //         hd.holiday_date
// // )
// // SELECT 
// //     emp_id,
// //     name,
// //     department,
// //     is_active,   
// //     JSON_AGG(
// //         JSON_BUILD_OBJECT(
// //             'date', date_only,
// //             'first_in', first_in,
// //             'last_out', last_out,
// //             'hours_worked', hours_worked,
// //             'status', status
// //         )
// //         ORDER BY date_only
// //     ) AS attendance
// // FROM daily
// // GROUP BY emp_id, name, department, is_active   
// // ORDER BY emp_id;
// //     `
//     const { rows } = await db.query(query, values);

//     return res.status(200).json({
//       success: true,
//       month: filterMonth,
//       year: filterYear,
//       total_records: rows.length,
//       attendance: rows,
//     });

//   } catch (error) {
//     console.error("All Attendance Report Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// });


// router.get("/weekly-attendance", auth, isAdmin, async (req, res) => {
//   try {

//     const { search, page = 1, limit = 10 } = req.query;

//     console.log("search", req.query.search)
//     const pageInt = parseInt(page);
//     const limitInt = parseInt(limit);
//     const offset = (pageInt - 1) * limitInt;

//     const searchTerm = search ? search.trim() : null;
//     const isTimeSearch = searchTerm && searchTerm.includes(":");

//     // console.log("searchTerm", searchTerm)
//     // console.log("isTimeSearch", isTimeSearch)

//     const now = new Date();
//     const toDate = now.toISOString().split("T")[0];

//     const sevenDaysAgo = new Date(now);
//     sevenDaysAgo.setDate(now.getDate() - 6);
//     const fromDate = sevenDaysAgo.toISOString().split("T")[0];
//     const timeSearch = isTimeSearch ? `%${searchTerm}%` : "%";

//     //    const query = `
//     // WITH calendar AS (
//     //   SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
//     // ),

//     // employees AS (
//     //   SELECT emp_id, name, role
//     //   FROM users
//     //   WHERE is_active = true
//     //   ORDER BY emp_id
//     //   OFFSET $5 LIMIT $6
//     // ),

//     // attendance AS (
//     //   SELECT 
//     //     al.emp_id,
//     //     al.punch_time::date AS date_only,
//     //     MIN(al.punch_time) AS first_in,
//     //     MAX(al.punch_time) AS last_out,
//     //     ROUND(
//     //       EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600,
//     //       2
//     //     ) AS total_hours
//     //   FROM attendance_logs al
//     //   WHERE al.punch_time::date BETWEEN $1 AND $2
//     //   GROUP BY al.emp_id, date_only
//     // )

//     // SELECT 
//     //   e.emp_id,
//     //   e.name,
//     //   e.role,
//     //   TO_CHAR(c.date_only,'YYYY-MM-DD') AS date,
//     //   TO_CHAR(a.first_in,'HH12:MI AM') AS first_in,
//     //   TO_CHAR(a.last_out,'HH12:MI AM') AS last_out,
//     //   COALESCE(a.total_hours,0) AS total_hours

//     // FROM employees e
//     // CROSS JOIN calendar c

//     // LEFT JOIN attendance a
//     //   ON a.emp_id = e.emp_id
//     //   AND a.date_only = c.date_only

//     // WHERE (
//     //   $3::text IS NULL
//     //   OR e.emp_id::text ILIKE $4
//     //   OR e.name ILIKE $4
//     //   OR ($7::boolean AND (
//     //         COALESCE(TO_CHAR(a.first_in,'HH24:MI'),'') LIKE $8
//     //      OR COALESCE(TO_CHAR(a.last_out,'HH24:MI'),'') LIKE $8
//     //   ))
//     // )

//     // ORDER BY e.emp_id, c.date_only DESC;
//     // `;
//     const query = `
// WITH calendar AS (
//   SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
// ),
// employees AS (
//   SELECT emp_id, name, role
//   FROM users
//   WHERE is_active = true
//   ORDER BY emp_id
//   OFFSET $5 LIMIT $6
// ),
// attendance_summary AS (
//   SELECT 
//     al.emp_id,
//     al.punch_time::date AS date_only,
//     MIN(al.punch_time) AS first_in,
//     CASE 
//       WHEN COUNT(*) > 1 THEN MAX(al.punch_time)
//       ELSE NULL
//     END AS last_out,
//     CASE 
//       WHEN COUNT(*) > 1 THEN ROUND(
//         EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600, 2
//       )
//       ELSE 0
//     END AS total_hours
//   FROM attendance_logs al
//   WHERE al.punch_time::date BETWEEN $1 AND $2
//   GROUP BY al.emp_id, al.punch_time::date
// )

// SELECT 
//   c.date_only,  -- keep raw date for proper ordering
//   e.emp_id,
//   e.name,
//   e.role,
//   TO_CHAR(c.date_only,'YYYY-MM-DD') AS date,
//   TO_CHAR(a.first_in,'HH12:MI AM') AS first_in,
//   TO_CHAR(a.last_out,'HH12:MI AM') AS last_out,
//   COALESCE(a.total_hours,0) AS total_hours,

//   CASE
//     WHEN a.first_in IS NULL THEN 'Absent'

//     WHEN a.first_in IS NOT NULL 
//          AND a.last_out IS NULL 
//          AND a.first_in::time < time '10:00:00' THEN 'Working'

//     WHEN a.first_in > (c.date_only + time '09:30:00' + interval '30 minutes') THEN 'Late Come'

//     WHEN a.last_out IS NOT NULL AND a.last_out < (
//         a.first_in + 
//         INTERVAL '7:30 hours' * (CASE WHEN EXTRACT(DOW FROM c.date_only) = 6 THEN 5.0/8 ELSE 1 END)
//     ) THEN 'Early Go'

//     WHEN a.total_hours >= (
//       CASE 
//           WHEN EXTRACT(DOW FROM c.date_only) = 6 THEN 5 - (10.0/60)
//           ELSE 8 - (10.0/60)
//       END
//     ) THEN 'Present'

//     ELSE 'Absent'
//   END AS status 

// FROM employees e
// CROSS JOIN calendar c
// LEFT JOIN attendance_summary a
//   ON a.emp_id = e.emp_id
//   AND a.date_only = c.date_only

// -- Only last 7 days
// WHERE c.date_only BETWEEN CURRENT_DATE - INTERVAL '6 days' AND CURRENT_DATE

// AND (
//     $3::text IS NULL
//     OR (
//         $7::boolean = false AND (
//             e.emp_id::text ILIKE $4
//             OR e.name ILIKE $4
//         )
//     )
//     OR (
//         $7::boolean = true AND (
//             COALESCE(TO_CHAR(a.first_in,'HH12:MI AM'),'') ILIKE $8
//             OR COALESCE(TO_CHAR(a.last_out,'HH12:MI AM'),'') ILIKE $8
//         )
//     )
// )

// -- IMPORTANT: this makes "daily attendance style"
// ORDER BY c.date_only DESC, e.emp_id;
// `;

// /*

// // SELECT 
// //   e.emp_id,
// //   e.name,
// //   e.role,
// //   TO_CHAR(c.date_only,'YYYY-MM-DD') AS date,
// //   TO_CHAR(a.first_in,'HH12:MI AM') AS first_in,
// //   TO_CHAR(a.last_out,'HH12:MI AM') AS last_out,
// //   COALESCE(a.total_hours,0) AS total_hours,
// //   -- Attendance status
// //   CASE
// //     -- Absent
// //     WHEN a.first_in IS NULL THEN 'Absent'

// //     -- Working: punched in but not punched out, and first_in before 10:00
// //     WHEN a.first_in IS NOT NULL 
// //          AND a.last_out IS NULL 
// //          AND a.first_in::time < time '10:00:00' THEN 'Working'

// //     -- Late Coming: punch-in after 9:30 + 30 min buffer
// //     WHEN a.first_in > (c.date_only + time '09:30:00' + interval '30 minutes') THEN 'Late Come'

// //     -- Early Go: left before minimum expected hours
// //     WHEN a.last_out IS NOT NULL AND a.last_out < (
// //         a.first_in + 
// //         INTERVAL '7:30 hours' * (CASE WHEN EXTRACT(DOW FROM c.date_only) = 6 THEN 5.0/8 ELSE 1 END)
// //     ) THEN 'Early Go'

// //     -- Present: total_hours >= expected threshold
// //   WHEN a.total_hours >= (
// //     CASE 
// //         WHEN EXTRACT(DOW FROM c.date_only) = 6 THEN 5 - (10.0/60)
// //         ELSE 8 - (10.0/60)
// //     END
// // ) THEN 'Present'

// //     ELSE 'Absent'
// // END AS status 
// // FROM employees e
// // CROSS JOIN calendar c
// // LEFT JOIN attendance_summary a
// //   ON a.emp_id = e.emp_id
// //   AND a.date_only = c.date_only
// // WHERE (
// //     $3::text IS NULL
// //     OR (
// //         $7::boolean = false AND (
// //             e.emp_id::text ILIKE $4
// //             OR e.name ILIKE $4
// //         )
// //     )
// //     OR (
// //         $7::boolean = true AND (
// //             COALESCE(TO_CHAR(a.first_in,'HH12:MI AM'),'') ILIKE $8
// //             OR COALESCE(TO_CHAR(a.last_out,'HH12:MI AM'),'') ILIKE $8
// //         )
// //     )
// // )
// // ORDER BY e.emp_id, c.date_only DESC;*/
//     // const { rows } = await db.query(query, [
//     //   fromDate,                     // $1
//     //   toDate,                       // $2
//     //   searchTerm || null,           // $3
//     //   searchTerm ? `%${searchTerm}%` : null, // $4
//     //   offset,                       // $5
//     //   limitInt,                     // $6
//     //   isTimeSearch || false,        // $7
//     //   timeSearch                    // $8
//     // ]);

//     // const timeSearch = isTimeSearch ? `%${searchTerm}%` : null;

//     const { rows } = await db.query(query, [
//       fromDate,                     // $1
//       toDate,                       // $2
//       searchTerm || null,           // $3
//       searchTerm ? `%${searchTerm}%` : null, // $4
//       offset,                       // $5
//       limitInt,                     // $6
//       isTimeSearch || false,        // $7
//       timeSearch                    // $8
//     ]);
//     // console.log("Weekly Attendance",rows);

//     if (!rows || rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No attendance data found",
//       });
//     }

//     const grouped = {};

//     rows.forEach((row) => {
//       if (!grouped[row.emp_id]) {
//         grouped[row.emp_id] = {
//           emp_id: row.emp_id,
//           name: row.name,
//           role: row.role,
//           attendance: [],
          
//         };
//       }

//       grouped[row.emp_id].attendance.push({
//         date: row.date,
//         first_in: row.first_in,
//         last_out: row.last_out,
//         total_hours: row.total_hours,
//         status:row.status
//       });
//     });

//     res.status(200).json({
//       success: true,
//       message: "Weekly attendance fetched successfully",
//       data: Object.values(grouped),
//     });

//   } catch (error) {

//     console.error("Attendance API Error:", error);

//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });

//   }
// });
router.get("/weekly-attendance", auth, isAdmin, async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 10,
      weekStart,
      weekEnd,
    } = req.query;

    const pageInt = Math.max(parseInt(page) || 1, 1);
    const limitInt = Math.max(parseInt(limit) || 10, 1);
    const offset = (pageInt - 1) * limitInt;

    const searchTerm =
      search && search.trim()
        ? search.trim()
        : null;

    const isTimeSearch =
      !!searchTerm && searchTerm.includes(":");

    /*
     * =========================================================
     * RESOLVE DATE RANGE
     * =========================================================
     */
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

    let fromDate;
    let today;

    if (weekStart || weekEnd) {
      if (!weekStart || !weekEnd) {
        return res.status(400).json({
          success: false,
          message: "Both weekStart and weekEnd are required together",
        });
      }

      if (!DATE_REGEX.test(weekStart) || !DATE_REGEX.test(weekEnd)) {
        return res.status(400).json({
          success: false,
          message: "weekStart and weekEnd must be in YYYY-MM-DD format",
        });
      }

      const startDate = new Date(weekStart);
      const endDate = new Date(weekEnd);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "weekStart or weekEnd is not a valid date",
        });
      }

      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: "weekStart must be before or equal to weekEnd",
        });
      }

      const MAX_RANGE_DAYS = 31;
      const rangeDays =
        Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      if (rangeDays > MAX_RANGE_DAYS) {
        return res.status(400).json({
          success: false,
          message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
        });
      }

      fromDate = weekStart;
      today = weekEnd;
    } else {
      const dateQuery = `
        SELECT
          (
            CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
          )::DATE AS today,

          (
            (
              CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
            )::DATE - 6
          ) AS from_date
      `;

      const { rows: dateRows } = await db.query(dateQuery);

      today = dateRows[0].today;
      fromDate = dateRows[0].from_date;
    }

    /*
     * =========================================================
     * COUNT ACTIVE EMPLOYEES
     * =========================================================
     */
    const countQuery = `
      SELECT COUNT(DISTINCT o.or_id) AS total

      FROM public.organizations o

      INNER JOIN public.personal p
        ON p.pr_id = o.pr_id

      WHERE o.or_emp_id IS NOT NULL
        AND TRIM(o.or_emp_id) <> ''

        AND COALESCE(
          o.or_is_active,
          FALSE
        ) = TRUE
    `;

    const countResult = await db.query(countQuery);

    const totalItems = parseInt(
      countResult.rows[0].total,
      10
    );
    /*
 * =========================================================
 * TODAY ATTENDANCE SUMMARY
 * =========================================================
 */

const todayAttendanceQuery = `
  WITH active_employees AS (
    SELECT DISTINCT
      TRIM(o.or_emp_id) AS emp_id
    FROM public.organizations o
    INNER JOIN public.personal p
      ON p.pr_id = o.pr_id
    WHERE o.or_emp_id IS NOT NULL
      AND TRIM(o.or_emp_id) <> ''
      AND COALESCE(o.or_is_active, FALSE) = TRUE
  ),

  today_attendance AS (
    SELECT DISTINCT
      TRIM(wa.emp_id) AS emp_id,
      wa.punch_in,
      wa.punch_out
    FROM public.weekly_attendance wa
    WHERE wa.attendance_date = (
      CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
    )::DATE
  )

  SELECT
    COUNT(a.emp_id) AS total_employees,

    COUNT(
      CASE
        WHEN ta.punch_in IS NOT NULL
        THEN 1
      END
    ) AS present,

    COUNT(
      CASE
        WHEN ta.punch_in IS NOT NULL
         AND ta.punch_out IS NULL
        THEN 1
      END
    ) AS working,

    COUNT(
      CASE
        WHEN ta.punch_in IS NULL
        THEN 1
      END
    ) AS absent

  FROM active_employees a

  LEFT JOIN today_attendance ta
    ON ta.emp_id = a.emp_id;
`;

const todayAttendanceResult = await db.query(todayAttendanceQuery);

const todaySummary = {
  totalEmployees: parseInt(
    todayAttendanceResult.rows[0].total_employees,
    10
  ),

  present: parseInt(
    todayAttendanceResult.rows[0].present,
    10
  ),

  working: parseInt(
    todayAttendanceResult.rows[0].working,
    10
  ),

  absent: parseInt(
    todayAttendanceResult.rows[0].absent,
    10
  ),
};

    /*
     * =========================================================
     * WEEKLY ATTENDANCE
     * =========================================================
     */
    const query = `
      WITH calendar AS
      (
        SELECT
          generate_series(
            $1::DATE,
            $2::DATE,
            INTERVAL '1 day'
          )::DATE AS date_only
      ),

      employees AS
      (
        SELECT DISTINCT

          TRIM(o.or_emp_id) AS emp_id,

          COALESCE(
            NULLIF(
              TRIM(p.pr_first_name),
              ''
            ),

            NULLIF(
              TRIM(
                CONCAT_WS(
                  ' ',
                  p.pr_first_name,
                  p.pr_last_name
                )
              ),
              ''
            ),

            '-'
          ) AS name,

          'employee' AS role,

          COALESCE(
            o.or_is_active,
            FALSE
          ) AS is_active

        FROM public.organizations o

        INNER JOIN public.personal p
          ON p.pr_id = o.pr_id

        WHERE o.or_emp_id IS NOT NULL
          AND TRIM(o.or_emp_id) <> ''

          AND COALESCE(
            o.or_is_active,
            FALSE
          ) = TRUE

        ORDER BY
          TRIM(o.or_emp_id)

        OFFSET $3
        LIMIT $4
      )

      SELECT

        c.date_only,

        TO_CHAR(
          c.date_only,
          'YYYY-MM-DD'
        ) AS date,

        e.emp_id,
        e.name,
        e.role,
        e.is_active,

        wa.id AS attendance_id,
        wa.attendance_date,
        wa.punch_in,
        wa.punch_out,

        /*
         * Raw seconds — used for accurate summation across
         * the date range. Formatted total_hours below is for
         * per-day display only; don't sum the formatted string.
         */
        COALESCE(
          EXTRACT(EPOCH FROM wa.total_hours),
          0
        )::BIGINT AS total_seconds,

        CASE
          WHEN wa.total_hours IS NULL THEN
            '00:00'

          ELSE
            LPAD(
              FLOOR(
                EXTRACT(EPOCH FROM wa.total_hours) / 3600
              )::TEXT,
              2,
              '0'
            )
            || ':' ||
            LPAD(
              FLOOR(
                MOD(
                  EXTRACT(EPOCH FROM wa.total_hours),
                  3600
                ) / 60
              )::TEXT,
              2,
              '0'
            )
        END AS total_hours,

        CASE
          WHEN wa.expected_hours IS NULL THEN
            '09:00'

          ELSE
            LPAD(
              FLOOR(
                EXTRACT(EPOCH FROM wa.expected_hours) / 3600
              )::TEXT,
              2,
              '0'
            )
            || ':' ||
            LPAD(
              FLOOR(
                MOD(
                  EXTRACT(EPOCH FROM wa.expected_hours),
                  3600
                ) / 60
              )::TEXT,
              2,
              '0'
            )
        END AS expected_hours,

        wa.late_arrival,
        wa.is_late_arrived,
        wa.early_go,
        wa.is_early_gone,
        wa.status_id,

        ast.status_name AS status

      FROM employees e

      CROSS JOIN calendar c

      LEFT JOIN public.weekly_attendance wa
        ON TRIM(wa.emp_id) = TRIM(e.emp_id)

        AND wa.attendance_date = c.date_only

      LEFT JOIN public.attendence_status ast
        ON ast.id = wa.status_id

        AND COALESCE(
          ast.is_active,
          TRUE
        ) = TRUE

      WHERE
      (
        $5::TEXT IS NULL

        OR

        (
          $6::BOOLEAN = FALSE

          AND
          (
            e.emp_id ILIKE $7

            OR

            e.name ILIKE $7
          )
        )

        OR

        (
          $6::BOOLEAN = TRUE

          AND
          (
            COALESCE(
              TO_CHAR(
                wa.punch_in,
                'HH12:MI AM'
              ),
              ''
            ) ILIKE $8

            OR

            COALESCE(
              TO_CHAR(
                wa.punch_out,
                'HH12:MI AM'
              ),
              ''
            ) ILIKE $8
          )
        )
      )

      ORDER BY
        c.date_only DESC,
        e.emp_id;
    `;

    const searchLike =
      searchTerm
        ? `%${searchTerm}%`
        : null;

    const timeSearch =
      isTimeSearch
        ? `%${searchTerm}%`
        : "%";

    const { rows } = await db.query(
      query,
      [
        fromDate,      // $1
        today,         // $2
        offset,        // $3
        limitInt,      // $4
        searchTerm,    // $5
        isTimeSearch,  // $6
        searchLike,    // $7
        timeSearch     // $8
      ]
    );

    console.log(
      "Weekly attendance rows fetched:",
      rows.length
    );

    /*
     * =========================================================
     * FORMAT HELPER: seconds -> "HH:MM"
     *
     * Deliberately does NOT wrap at 24 — a week's total can
     * legitimately exceed 24 hours (e.g. "48:30").
     * =========================================================
     */
    function formatSecondsToHHMM(totalSeconds) {
      const safeSeconds = Number(totalSeconds) || 0;
      const hours = Math.floor(safeSeconds / 3600);
      const minutes = Math.floor((safeSeconds % 3600) / 60);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    const formattedRows = rows.map((row) => {

      const punchIn =
        row.punch_in
          ? new Date(row.punch_in).toLocaleTimeString(
              "en-IN",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }
            )
          : "-";

      const punchOut =
        row.punch_out
          ? new Date(row.punch_out).toLocaleTimeString(
              "en-IN",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }
            )
          : "-";

      return {
        date: row.date,
        emp_id: row.emp_id,
        name: row.name,
        role: row.role,
        first_in: punchIn,
        last_out: punchOut,
        total_hours: row.total_hours || "00:00",
        total_seconds: Number(row.total_seconds) || 0,
        expected_hours: row.expected_hours || "09:00",
        late_arrival: row.late_arrival,
        is_late_arrived: row.is_late_arrived,
        early_go: row.early_go,
        is_early_gone: row.is_early_gone,
        status_id: row.status_id,
        status: row.status,
      };
    });

    /*
     * =========================================================
     * GROUP BY DATE (unchanged)
     * =========================================================
     */
    const grouped = {};

    formattedRows.forEach((row) => {
      if (!grouped[row.date]) {
        grouped[row.date] = {
          date: row.date,
          employees: [],
        };
      }

      grouped[row.date].employees.push({
        emp_id: row.emp_id,
        name: row.name,
        role: row.role,
        first_in: row.first_in,
        last_out: row.last_out,
        total_hours: row.total_hours,
        expected_hours: row.expected_hours,
        late_arrival: row.late_arrival,
        is_late_arrived: row.is_late_arrived,
        early_go: row.early_go,
        is_early_gone: row.is_early_gone,
        status_id: row.status_id,
        status: row.status,
      });
    });

    const result = Object.values(grouped).sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );

    /*
     * =========================================================
     * TOTAL HOURS WITHIN THE DATE RANGE
     * =========================================================
     *
     * - employeeTotals: sum per employee across every date
     *   returned (respects current pagination — only the
     *   employees on this page are summed).
     * - grandTotalHours: sum across all employees + all dates
     *   in this response.
     */
    const employeeTotalsMap = {};

    formattedRows.forEach((row) => {
      if (!employeeTotalsMap[row.emp_id]) {
        employeeTotalsMap[row.emp_id] = {
          emp_id: row.emp_id,
          name: row.name,
          total_seconds: 0,
        };
      }
      employeeTotalsMap[row.emp_id].total_seconds += row.total_seconds;
    });

    const employeeTotals = Object.values(employeeTotalsMap).map((e) => ({
      emp_id: e.emp_id,
      name: e.name,
      total_hours: formatSecondsToHHMM(e.total_seconds),
    }));

    const grandTotalSeconds = formattedRows.reduce(
      (sum, row) => sum + row.total_seconds,
      0
    );

    res.status(200).json({
  success: true,
  message: "Weekly attendance fetched successfully",

  data: result,

  // Pagination
  totalItems,
  page: pageInt,
  limit: limitInt,
  weekStart: fromDate,
  weekEnd: today,

  // Existing totals
  employeeTotals,
  grandTotalHours: formatSecondsToHHMM(grandTotalSeconds),

  // Today's attendance summary
  todaySummary,
});

  } catch (error) {
    console.error(
      "Weekly Attendance API Error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


module.exports = router;
