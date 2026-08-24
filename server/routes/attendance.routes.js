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

    const today = new Date();
    const filterMonth = parseInt(month) || today.getMonth() + 1;
    const filterYear = parseInt(year) || today.getFullYear();

    // console.log("filterMonth",filterMonth);
    // console.log("filterYear",filterYear);

    const fromDate = new Date(filterYear, filterMonth - 1, 1)
      .toISOString()
      .slice(0, 10);
    const toDate = new Date(filterYear, filterMonth, 1)
      .toISOString()
      .slice(0, 10);

    // console.log("fromDate",fromDate);
    // console.log("toDate",toDate);

    const values = [fromDate, toDate];

    const query = `
   WITH calendar AS (
    SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
),
daily AS (
    SELECT 
        u.emp_id,
        u.name,
        u.is_active,  
        p.department,
        cal.date_only,

    MIN(al.punch_time) AS first_in,

    CASE 
        WHEN COUNT(al.punch_time) > 1 
        THEN MAX(al.punch_time)
        ELSE NULL
    END AS last_out,

      CASE
    WHEN hd.holiday_date IS NOT NULL THEN 'Holiday'

    WHEN cal.date_only = CURRENT_DATE AND COUNT(al.punch_time) = 1 
        THEN 'Working'

    WHEN COUNT(al.punch_time) = 1 
        THEN 'Punch Miss'

    WHEN COUNT(al.punch_time) = 0 
        THEN 'Absent'

    ELSE 'Present'
END AS status,

        COALESCE(
          ROUND(
            EXTRACT(
              EPOCH FROM 
              MAX(al.punch_time) - MIN(al.punch_time)
            ) / 3600.0, 
            2
          ), 
          0.00
        ) AS hours_worked

    FROM users u
    CROSS JOIN calendar cal
    LEFT JOIN attendance_logs al
        ON al.emp_id = u.emp_id
        AND (
            (al.punch_time)::date = cal.date_only
        )
    LEFT JOIN personal p
        ON p.emp_id = u.emp_id
    LEFT JOIN holidays hd
        ON hd.holiday_date = cal.date_only
        WHERE u.is_active = true
    GROUP BY 
        u.emp_id, 
        u.name, 
        u.is_active,   
        p.department, 
        cal.date_only, 
        hd.holiday_date
)
SELECT 
    emp_id,
    name,
    department,
    is_active,   
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'date', date_only,
            'first_in', first_in,
            'last_out', last_out,
            'hours_worked', hours_worked,
            'status', status
        )
        ORDER BY date_only
    ) AS attendance
FROM daily
GROUP BY emp_id, name, department, is_active   
ORDER BY emp_id;
`;

//     const query = `
//     WITH calendar AS (
//     SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
// ),
// daily AS (
//     SELECT 
//         u.emp_id,
//         u.name,
//         u.is_active,  
//         p.department,
//         cal.date_only,

//         MIN(al.punch_time) AS first_in,

//         CASE 
//             WHEN COUNT(al.punch_time) > 1 
//             THEN MAX(al.punch_time)
//             ELSE NULL
//         END AS last_out,

//         COALESCE(
//           ROUND(
//             EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600.0, 
//             2
//           ), 
//           0.00
//         ) AS hours_worked,

//         -- Advanced status logic
//         CASE
//             -- Holiday
//             WHEN hd.holiday_date IS NOT NULL THEN 'Holiday'

//             -- Absent
//             WHEN MIN(al.punch_time) IS NULL THEN 'Absent'

//             -- Working: punched in but not punched out, before 10:00 AM
//             WHEN MIN(al.punch_time) IS NOT NULL
//                  AND (CASE WHEN COUNT(al.punch_time) > 1 THEN MAX(al.punch_time) ELSE NULL END) IS NULL
//                  AND MIN(al.punch_time)::time < time '10:00:00' THEN 'Working'

//             -- Late Coming: punch-in after 9:30 + 30 min buffer
//             WHEN MIN(al.punch_time) > (cal.date_only + time '09:30:00' + interval '30 minutes') THEN 'Late Come'

//             -- Early Go: left before minimum expected hours
//             WHEN (CASE WHEN COUNT(al.punch_time) > 1 THEN MAX(al.punch_time) ELSE NULL END) IS NOT NULL
//                  AND ROUND(EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600.0, 2) < 8
//                  AND (CASE WHEN COUNT(al.punch_time) > 1 THEN MAX(al.punch_time) ELSE NULL END) <
//                      (MIN(al.punch_time) + interval '7:30 hours' * (CASE WHEN EXTRACT(DOW FROM cal.date_only) = 6 THEN 5.0/8 ELSE 1 END))
//             THEN 'Early Go'

//             -- Present: worked enough hours (Saturday 5h, weekday 8h)
//             WHEN ROUND(EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600.0, 2) >=
//                  (CASE WHEN EXTRACT(DOW FROM cal.date_only) = 6 THEN 5 ELSE 8 END)
//             THEN 'Present'

//             ELSE 'Absent'
//         END AS status

//     FROM users u
//     CROSS JOIN calendar cal
//     LEFT JOIN attendance_logs al
//         ON al.emp_id = u.emp_id
//         AND (al.punch_time::date = cal.date_only)
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
//     `
    const { rows } = await db.query(query, values);

    return res.status(200).json({
      success: true,
      month: filterMonth,
      year: filterYear,
      total_records: rows.length,
      attendance: rows,
    });

  } catch (error) {
    console.error("All Attendance Report Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
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
    const { search, page = 1, limit = 10 } = req.query;

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const offset = (pageInt - 1) * limitInt;

    const searchTerm = search ? search.trim() : null;
    const isTimeSearch = searchTerm && searchTerm.includes(":");

    const now = new Date();
    const toDate = now.toISOString().split("T")[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    const fromDate = sevenDaysAgo.toISOString().split("T")[0];

    const timeSearch = isTimeSearch ? `%${searchTerm}%` : "%";

    const query = `
WITH calendar AS (
  SELECT generate_series($1::date, $2::date, '1 day')::date AS date_only
),
employees AS (
  SELECT emp_id, name, role
  FROM users
  WHERE is_active = true
  ORDER BY emp_id
  OFFSET $5 LIMIT $6
),
attendance_summary AS (
  SELECT 
    al.emp_id,
    al.punch_time::date AS date_only,
    MIN(al.punch_time) AS first_in,
    CASE 
      WHEN COUNT(*) > 1 THEN MAX(al.punch_time)
      ELSE NULL
    END AS last_out,
    CASE 
      WHEN COUNT(*) > 1 THEN ROUND(
        EXTRACT(EPOCH FROM (MAX(al.punch_time) - MIN(al.punch_time))) / 3600, 2
      )
      ELSE 0
    END AS total_hours
  FROM attendance_logs al
  WHERE al.punch_time::date BETWEEN $1 AND $2
  GROUP BY al.emp_id, al.punch_time::date
)

SELECT 
  c.date_only,
  e.emp_id,
  e.name,
  e.role,
  TO_CHAR(c.date_only,'YYYY-MM-DD') AS date,
  TO_CHAR(a.first_in,'HH12:MI am') AS first_in,
  TO_CHAR(a.last_out,'HH12:MI am') AS last_out,
  COALESCE(a.total_hours,0) AS total_hours,

  CASE
    WHEN a.first_in IS NULL THEN 'Absent'

    WHEN a.first_in IS NOT NULL 
         AND a.last_out IS NULL 
         AND a.first_in::time < time '10:00:00' THEN 'Working'

    WHEN a.first_in > (c.date_only + time '09:30:00' + interval '30 minutes') THEN 'Late Come'

    WHEN a.last_out IS NOT NULL AND a.last_out < (
        a.first_in + 
        INTERVAL '7:30 hours' * (CASE WHEN EXTRACT(DOW FROM c.date_only) = 6 THEN 5.0/8 ELSE 1 END)
    ) THEN 'Early Go'

    WHEN a.total_hours >= (
      CASE 
          WHEN EXTRACT(DOW FROM c.date_only) = 6 THEN 5 - (10.0/60)
          ELSE 8 - (10.0/60)
      END
    ) THEN 'Present'

    ELSE 'Absent'
  END AS status 

FROM employees e
CROSS JOIN calendar c
LEFT JOIN attendance_summary a
  ON a.emp_id = e.emp_id
  AND a.date_only = c.date_only

WHERE c.date_only BETWEEN CURRENT_DATE - INTERVAL '6 days' AND CURRENT_DATE

AND (
    $3::text IS NULL
    OR (
        $7::boolean = false AND (
            e.emp_id::text ILIKE $4
            OR e.name ILIKE $4
        )
    )
    OR (
        $7::boolean = true AND (
            COALESCE(TO_CHAR(a.first_in,'HH12:MI AM'),'') ILIKE $8
            OR COALESCE(TO_CHAR(a.last_out,'HH12:MI AM'),'') ILIKE $8
        )
    )
)

ORDER BY c.date_only DESC, e.emp_id;
`;

    const { rows } = await db.query(query, [
      fromDate,                     
      toDate,                       
      searchTerm || null,           
      searchTerm ? `%${searchTerm}%` : null,
      offset,                       
      limitInt,                     
      isTimeSearch || false,        
      timeSearch                    
    ]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No attendance data found",
      });
    }

    //  GROUP BY DATE (Daily Attendance View)
    const grouped = {};

    rows.forEach((row) => {
      if (!grouped[row.date]) {
        grouped[row.date] = {
          date: row.date,
          employees: []
        };
      }

      grouped[row.date].employees.push({
        emp_id: row.emp_id,
        name: row.name,
        role: row.role,
        first_in: row.first_in,
        last_out: row.last_out,
        total_hours: row.total_hours,
        status: row.status
      });
    });

    //  Convert to array & ensure sorting
    const result = Object.values(grouped).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.status(200).json({
      success: true,
      message: "Weekly attendance fetched successfully",
      data: result,
    });

  } catch (error) {
    console.error("Attendance API Error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


module.exports = router;
