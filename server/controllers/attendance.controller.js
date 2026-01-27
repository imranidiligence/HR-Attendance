const { db } = require("../db/connectDB");
const { getDeviceAttendance } = require("../services/zk.service");
// import sendEmail, { sendMail } from "../utils/mailer";
const bcrypt = require("bcrypt");
/* Sync machine logs */
exports.syncAttendance = async (req, res) => {
  await getDeviceAttendance();
  res.json({ message: "Machine logs synced" });
};

exports.getAdminMyAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;
    console.log("empId", empId);

    
    await db.query(`
      INSERT INTO daily_attendance (emp_id, attendance_date, punch_in, punch_out, expected_hours)
      SELECT
        emp_id,
        attendance_date,
        MIN(local_time) FILTER (WHERE local_time::time >= TIME '10:00') AS punch_in,
        MAX(local_time) AS punch_out,
        NULL AS expected_hours
      FROM (
        SELECT
          emp_id,
          punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
          CASE
            WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00'
            THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
            ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date
          END AS attendance_date
        FROM activity_log
        WHERE emp_id = $1
          AND (punch_time AT TIME ZONE 'Asia/Kolkata')::date >= CURRENT_DATE - INTERVAL '2 day'
      ) t
      GROUP BY emp_id, attendance_date
      ON CONFLICT (emp_id, attendance_date) DO NOTHING;
    `, [empId]);

    
    const { rows } = await db.query(`
      WITH dates AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE)::date,
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS attendance_date
      ),
      activity_data AS (
        SELECT
          emp_id,
          attendance_date,
          MIN(local_time) FILTER (WHERE local_time::time >= TIME '10:00') AS punch_in,
          MAX(local_time) AS punch_out
        FROM (
          SELECT
            emp_id,
            punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
            CASE
              WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00'
              THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
              ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date
            END AS attendance_date
          FROM activity_log
          WHERE emp_id = $1
        ) t
        GROUP BY emp_id, attendance_date
      ),
      daily_attendance_data AS (
        SELECT *
        FROM daily_attendance
        WHERE emp_id = $1
      ),
      attendance_log_data AS (
        SELECT
          emp_id,
          attendance_date,
          MIN(local_time) AS punch_in,
          MAX(local_time) AS punch_out
        FROM (
          SELECT
            emp_id,
            punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
            CASE
              WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00'
              THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
              ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date
            END AS attendance_date
          FROM attendance_logs
          WHERE emp_id = $1
        ) x
        GROUP BY emp_id, attendance_date
      )
      SELECT
        $1 AS emp_id,
        u.name AS employee_name,
        to_char(d.attendance_date, 'YYYY-MM-DD') AS attendance_date,
        COALESCE(ad.punch_in, da.punch_in, al.punch_in) AS punch_in,
        COALESCE(ad.punch_out, da.punch_out, al.punch_out) AS punch_out,
        CASE
          WHEN COALESCE(ad.punch_in, da.punch_in, al.punch_in) IS NOT NULL
           AND COALESCE(ad.punch_out, da.punch_out, al.punch_out) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (
            COALESCE(ad.punch_out, da.punch_out, al.punch_out)
            - COALESCE(ad.punch_in, da.punch_in, al.punch_in)
          ))
          ELSE NULL
        END AS total_seconds,
        da.expected_hours,
        CASE
          WHEN COALESCE(ad.punch_in, da.punch_in, al.punch_in) IS NULL THEN 'Absent'
          WHEN COALESCE(ad.punch_out, da.punch_out, al.punch_out) IS NULL THEN 'Working'
          ELSE 'Present'
        END AS status
      FROM dates d
      LEFT JOIN activity_data ad
        ON ad.emp_id = $1 AND ad.attendance_date = d.attendance_date
      LEFT JOIN daily_attendance_data da
        ON da.emp_id = $1 AND da.attendance_date = d.attendance_date
      LEFT JOIN attendance_log_data al
        ON al.emp_id = $1 AND al.attendance_date = d.attendance_date
      JOIN users u ON u.emp_id = $1
      ORDER BY d.attendance_date DESC;
    `, [empId]);

 
    const formatted = rows.map(r => {
      let total_hours = null;
      if (r.total_seconds !== null) {
        const secs = Number(r.total_seconds);
        total_hours = {
          hours: Math.floor(secs / 3600),
          minutes: Math.floor((secs % 3600) / 60)
        };
      }
      return { ...r, total_hours };
    });

    
    const employeeList = formatted.map(r => ({
      name: r.employee_name,
      date: r.attendance_date,
      punch_in: r.punch_in,
      punch_out: r.punch_out,
      status: r.status,
      total_hours: r.total_hours
    }));

    const time = new Date().toLocaleString("en-IN", { hour12: false });

    
    const adminEmail = "admin@example.com"; // replace with real admin email
    await sendEmail(adminEmail, "All Employees Present", "admin_all_present", {
      time,
      employee_list: employeeList
    });

  
    res.status(200).json({
      total_documents: formatted.length,
      attendance: formatted
    });

  } catch (err) {
    console.error("❌ getAdminMyAttendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.addEmployController = async (req, res) => {

  const client = await db.connect();

  // console.log(req.body)
  try {
    const {
      name,
      email,
      password,
      emp_id,
      role,
      shift_id,
      dob,
      gender,
      department,
      joining_date,
      maritalstatus,
      nominee,
      aadharnumber,
      bloodgroup,
      nationality,
      address,
      is_active,
    } = req.body;

    // 1. Validation
    if (!name || !email || !password || !emp_id || !department) {
      return res.status(400).json({ message: "All essential fields required" });
    }

    // 2. Start Transaction
    await client.query("BEGIN");

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const profile_image = req.file ? `/uploads/${req.file.filename}` : null;

    // 4. Insert into 'users' table
    const userResult = await client.query(
      `
      INSERT INTO users 
        (name, email, password, role, emp_id, is_active, shift_id, profile_image)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        name,
        email.toLowerCase().trim(),
        hashedPassword,
        role || "employee",
        emp_id,
        is_active === undefined ? true : is_active,
        shift_id || 1,
        profile_image,
      ]
    );

    const newUserId = userResult.rows[0].id;

    // 5. Insert into 'personal' table
    await client.query(
      `
      INSERT INTO personal 
        (emp_id, dob, gender, department, joining_date, maritalstatus, nominee, aadharnumber, bloodgroup, nationality, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        emp_id,
        dob || null,
        gender,
        department,
        joining_date || null,
        maritalstatus,
        nominee,
        aadharnumber,
        bloodgroup,
        nationality,
        address,
      ]
    );

    // 6. Commit Transaction
    await client.query("COMMIT");
    

    // await sendEmail(email, "Welcome to the Company", "employee_creation", { name, emp_id, email });


    res.status(201).json({
      message: "Employee created successfully",
      user: { id: newUserId, emp_id, name, email },
    });
    
  } catch (error) {
    // 7. Rollback in case of error (avoids partial data)
    await client.query("ROLLBACK");
    console.error("Transaction Error:", error);
    
    // Handle unique constraint errors (e.g., duplicate email or emp_id)
    if (error.code === '23505') {
        return res.status(400).json({ message: "Email or Employee ID already exists" });
    }
    
    res.status(500).json({ message: "Internal Server Error" });
  // } finally {
    // Release client back to the pool
    client.release();
  }
};



function toIST(date) {
  return new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false
  });
}

function calculateHours(punchIn, punchOut) {
  const start = new Date(punchIn);
  const end = new Date(punchOut);

  const diffMs = end - start; // milliseconds
  if (diffMs <= 0) return "00:00";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}



/*  Generate daily attendance */
exports.getTodayAttendance = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.name,
        u.device_user_id,

        CASE
          WHEN d.punch_in IS NOT NULL AND d.punch_out IS NOT NULL THEN 'Present'
          WHEN d.punch_in IS NOT NULL AND d.punch_out IS NULL THEN 'Working'
          ELSE 'Absent'
        END AS status,

        d.punch_in,
        d.punch_out,
        COALESCE(d.total_hours, 0) AS total_hours

      FROM users u
      LEFT JOIN daily_attendance d
        ON u.id = d.device_user_id
        AND d.attendance_date = CURRENT_DATE
      WHERE u.role = 'employee'
      ORDER BY u.name;
    `);

    // 📊 Dashboard counts
    const summary = {
      total_employees: result.rows.length,
      present_today: result.rows.filter(
        e => e.status === 'Present' || e.status === 'Working'
      ).length,
      absent_today: result.rows.filter(e => e.status === 'Absent').length
    };

    res.json({
      summary,
      employees: result.rows
    });

  } catch (err) {
    console.error("getTodayAttendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// /*  Admin – today attendance */ 

exports.generateDailyAttendance = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id,
        u.name,
        u.emp_id,
        CASE
          WHEN d.punch_in IS NOT NULL AND d.punch_out IS NOT NULL THEN 'Present'
          WHEN d.punch_in IS NOT NULL AND d.punch_out IS NULL THEN 'Working'
          ELSE 'Absent'
        END AS status,
        d.punch_in,
        d.punch_out,
        COALESCE(d.total_hours, 0) AS total_hours
      FROM users u
      LEFT JOIN daily_attendance d
        ON u.id = d.user_id
        AND d.attendance_date = CURRENT_DATE
      WHERE u.role = 'employee'
      ORDER BY u.name;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// Main
// exports.getTodayOrganizationAttendance = async (req, res) => {
//   try {
//     await db.query(`
//       WITH params AS (
//         SELECT
//           (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE AS ist_date,
//           ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE + TIME '10:30') AS punch_in_start,
//           ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE + TIME '19:00') AS punch_out_start
//       ),

//       punch_calc AS (
//         SELECT
//           al.emp_id,
//           p.ist_date AS attendance_date,

//           -- First punch AFTER 10:30 AM
//           MIN(al.punch_time AT TIME ZONE 'Asia/Kolkata')
//             FILTER (
//               WHERE (al.punch_time AT TIME ZONE 'Asia/Kolkata') >= p.punch_in_start
//             ) AS punch_in,

//           -- First punch AT or AFTER 7:00 PM
//           MIN(al.punch_time AT TIME ZONE 'Asia/Kolkata')
//             FILTER (
//               WHERE (al.punch_time AT TIME ZONE 'Asia/Kolkata') >= p.punch_out_start
//             ) AS punch_out

//         FROM attendance_logs al
//         CROSS JOIN params p
//         WHERE (al.punch_time AT TIME ZONE 'Asia/Kolkata')::DATE = p.ist_date
//         GROUP BY al.emp_id, p.ist_date
//       )

//       INSERT INTO daily_attendance (
//         emp_id,
//         attendance_date,
//         punch_in,
//         punch_out,
//         total_hours,
//         expected_hours,
//         status
//       )
//       SELECT
//         pc.emp_id,
//         pc.attendance_date,
//         pc.punch_in,
//         pc.punch_out,

//         CASE
//           WHEN pc.punch_in IS NOT NULL AND pc.punch_out IS NOT NULL
//           THEN pc.punch_out - pc.punch_in
//           ELSE INTERVAL '0 minutes'
//         END,

//         INTERVAL '9 hours',

//         CASE
//           WHEN pc.punch_in IS NULL THEN 'Absent'
//           WHEN pc.punch_out IS NULL THEN 'Working'
//           ELSE 'Present'
//         END

//       FROM punch_calc pc

//       ON CONFLICT (emp_id, attendance_date)
//       DO UPDATE SET
//         punch_in    = EXCLUDED.punch_in,
//         punch_out   = EXCLUDED.punch_out,
//         total_hours = EXCLUDED.total_hours,
//         status      = EXCLUDED.status;
//     `);

//     /* -------- FETCH TODAY (IST) -------- */
//     const { rows } = await db.query(`
//       SELECT
//         u.emp_id,
//         u.name,
//         u.email,
//         u.is_active,

//         TO_CHAR(
//           (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
//           'YYYY-MM-DD'
//         ) AS attendance_date,

//         a.punch_in,
//         a.punch_out,
//         COALESCE(a.total_hours, INTERVAL '0 minutes') AS total_hours,
//         COALESCE(a.expected_hours, INTERVAL '9 hours') AS expected_hours,

//         CASE
//           WHEN u.is_active = FALSE THEN 'Inactive'
//           WHEN a.emp_id IS NULL THEN 'Absent'
//           ELSE a.status
//         END AS status

//       FROM users u
//       LEFT JOIN daily_attendance a
//         ON a.emp_id = u.emp_id
//        AND a.attendance_date =
//          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE

//       WHERE u.role = 'employee'
//       ORDER BY u.name;
//     `);

//     res.status(200).json(rows);

//   } catch (error) {
//     console.error("❌ Attendance fetch error:", error);
//     res.status(500).json({ message: "Failed to fetch today's attendance" });
//   }
// };


















// exports.getTodayOrganizationAttendance = async (req, res) => {
//   try {
//     const { rows } = await db.query(`
//       SELECT
//         u.id AS emp_id,
//         u.device_user_id,
//         u.name,

//         -- ✅ Today date strictly in IST
//         (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE AS attendance_date,

//         a.punch_in,
//         a.punch_out,

//         COALESCE(a.total_hours, INTERVAL '0 minutes') AS total_hours,
//         INTERVAL '9 hours' AS expected_hours,

//         CASE
//           WHEN a.emp_id IS NULL THEN 'Absent'
//           WHEN a.punch_in IS NOT NULL AND a.punch_out IS NULL THEN 'Working'
//           ELSE 'Present'
//         END AS status

//       FROM users u
//       LEFT JOIN daily_attendance a
//         ON a.emp_id = u.id
//        AND a.attendance_date =
//            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE

//       WHERE u.role = 'employee'
//       ORDER BY u.name;
//     `);

//     res.json(rows);
//   } catch (err) {
//     console.error("❌ getTodayOrganizationAttendance:", err);
//     res.status(500).json({ message: "Failed to fetch attendance" });
//   }
// };







// /*  Employee – Today attendance */  

// single Emp Attendance

// Main Code
// exports.getMyTodayAttendance = async (req, res) => {
//   try {
//     const empId = req.user.emp_id;

//     /* -------------------------------------------------
//        TODAY ATTENDANCE (daily_attendance FIRST)
//     --------------------------------------------------*/
//     let today;
//     let todayHours = "00:00";

//     const dailyResult = await db.query(
//       `
//       SELECT punch_in, punch_out, total_hours, status
//       FROM daily_attendance
//       WHERE emp_id = $1
//         AND attendance_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
//       LIMIT 1
//       `,
//       [empId]
//     );

//     if (dailyResult.rows.length > 0) {
//       today = dailyResult.rows[0];

//       if (today.total_hours) {
//         const seconds =
//           parseInt(today.total_hours.split(":")[0]) * 3600 +
//           parseInt(today.total_hours.split(":")[1]) * 60;

//         const hrs = Math.floor(seconds / 3600);
//         const mins = Math.floor((seconds % 3600) / 60);

//         todayHours = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
//           2,
//           "0"
//         )}`;
//       }
//     } else {
//       const liveResult = await db.query(
//         `
//         WITH today_logs AS (
//           SELECT
//             MIN(punch_time AT TIME ZONE 'Asia/Kolkata') AS punch_in,
//             MAX(punch_time AT TIME ZONE 'Asia/Kolkata') AS punch_out
//           FROM attendance_logs
//           WHERE emp_id = $1
//             AND (punch_time AT TIME ZONE 'Asia/Kolkata')::DATE =
//                 (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
//         )
//         SELECT
//           punch_in,
//           CASE
//             WHEN punch_in IS NULL THEN NULL
//             WHEN punch_out = punch_in THEN NULL
//             ELSE punch_out
//           END AS punch_out,
//           CASE
//             WHEN punch_in IS NULL THEN 'Absent'
//             WHEN punch_out = punch_in THEN 'Working'
//             ELSE 'Present'
//           END AS status,
//           CASE
//             WHEN punch_in IS NULL THEN INTERVAL '0'
//             WHEN punch_out = punch_in
//               THEN (NOW() AT TIME ZONE 'Asia/Kolkata') - punch_in
//             ELSE punch_out - punch_in
//           END AS total_hours
//         FROM today_logs
//         `,
//         [empId]
//       );

//       today = liveResult.rows[0];

//       if (today?.total_hours) {
//         const totalSeconds = Math.floor(
//           today.total_hours.seconds ||
//           (today.total_hours.hours || 0) * 3600 +
//           (today.total_hours.minutes || 0) * 60
//         );

//         const hrs = Math.floor(totalSeconds / 3600);
//         const mins = Math.floor((totalSeconds % 3600) / 60);

//         todayHours = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
//           2,
//           "0"
//         )}`;
//       }
//     }

//     /* -------------------------------------------------
//        WEEKLY HOURS (ALREADY CORRECT)
//     --------------------------------------------------*/
//     const weeklyResult = await db.query(
//       `
//       WITH week_bounds AS (
//         SELECT
//           DATE_TRUNC(
//             'week',
//             (NOW() AT TIME ZONE 'Asia/Kolkata')
//           )::DATE AS week_start,
//           ((NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '1 day')::DATE AS week_end
//       )
//       SELECT
//         COALESCE(
//           SUM(
//             EXTRACT(
//               EPOCH FROM (punch_out - punch_in)
//             )
//           ),
//           0
//         ) AS total_seconds
//       FROM daily_attendance, week_bounds
//       WHERE emp_id = $1
//         AND attendance_date BETWEEN week_bounds.week_start AND week_bounds.week_end
//         AND punch_in IS NOT NULL
//         AND punch_out IS NOT NULL
//         AND status = 'Present'
//       `,
//       [empId]
//     );





//     const weeklySeconds = Number(weeklyResult.rows[0].total_seconds);

//     const weeklyHrs = Math.floor(weeklySeconds / 3600);
//     const weeklyMins = Math.floor((weeklySeconds % 3600) / 60);

//     const weeklyHours = `${String(weeklyHrs).padStart(2, "0")}:${String(
//       weeklyMins
//     ).padStart(2, "0")}`;


//     /* -------------------------------------------------
//        RESPONSE
//     --------------------------------------------------*/
//     res.json({
//       today: {
//         punch_in: today?.punch_in ?? null,
//         punch_out: today?.punch_out ?? null,
//         total_hours: todayHours,
//         status: today?.status ?? "Absent",
//       },
//       weekly: {
//         total_hours: `${String(weeklyHrs).padStart(2, "0")}:${String(
//           weeklyMins
//         ).padStart(2, "0")}`,
//       },
//     });
//   } catch (err) {
//     console.error("❌ getMyTodayAttendance error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// Activity Logs
// const { db } = require("../db/connectDB");


exports.getTodayOrganizationAttendance = async (req, res) => {
  try {
    /* -------------------------------------------------
       STEP 1: AGGREGATE TODAY'S ATTENDANCE (IST)
       - Punch-in: first punch after 10:30 AM
       - Punch-out: first punch after 7:00 PM
       - total_hours ONLY when punch-out exists
    --------------------------------------------------*/
    await db.query(`
      WITH params AS (
        SELECT
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE AS ist_date,
          ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE + TIME '10:30') AS punch_in_start,
          ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE + TIME '19:00') AS punch_out_start
      ),

      punch_calc AS (
        SELECT
          al.emp_id,
          p.ist_date AS attendance_date,

          -- First punch after 10:30 AM
          MIN(al.punch_time AT TIME ZONE 'Asia/Kolkata')
            FILTER (
              WHERE (al.punch_time AT TIME ZONE 'Asia/Kolkata') >= p.punch_in_start
            ) AS punch_in,

          -- First punch after 7:00 PM
          MIN(al.punch_time AT TIME ZONE 'Asia/Kolkata')
            FILTER (
              WHERE (al.punch_time AT TIME ZONE 'Asia/Kolkata') >= p.punch_out_start
            ) AS punch_out

        FROM attendance_logs al
        CROSS JOIN params p
        WHERE (al.punch_time AT TIME ZONE 'Asia/Kolkata')::DATE = p.ist_date
        GROUP BY al.emp_id, p.ist_date
      )

      INSERT INTO daily_attendance (
        emp_id,
        attendance_date,
        punch_in,
        punch_out,
        total_hours,
        expected_hours,
        status
      )
      SELECT
        pc.emp_id,
        pc.attendance_date,
        pc.punch_in,
        pc.punch_out,

        --  WORKING HOURS ONLY AFTER PUNCH-OUT
        CASE
          WHEN pc.punch_in IS NOT NULL
           AND pc.punch_out IS NOT NULL
          THEN pc.punch_out - pc.punch_in
          ELSE NULL
        END AS total_hours,

        INTERVAL '9 hours',

        CASE
          WHEN pc.punch_in IS NULL THEN 'Absent'
          WHEN pc.punch_out IS NULL THEN 'Working'
          ELSE 'Present'
        END AS status

      FROM punch_calc pc

      ON CONFLICT (emp_id, attendance_date)
      DO UPDATE SET
        punch_in    = EXCLUDED.punch_in,
        punch_out   = EXCLUDED.punch_out,
        total_hours = EXCLUDED.total_hours,
        status      = EXCLUDED.status;
    `);

    /* -------------------------------------------------
       STEP 2: FETCH TODAY'S ATTENDANCE FOR UI
    --------------------------------------------------*/
    const { rows } = await db.query(`
      SELECT
        u.emp_id,
        u.name,
        u.email,
        u.is_active,

        TO_CHAR(
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
          'YYYY-MM-DD'
        ) AS attendance_date,

        a.punch_in,
        a.punch_out,

        -- Format hours safely for UI
        CASE
          WHEN a.total_hours IS NULL THEN NULL
          ELSE TO_CHAR(a.total_hours, 'HH24:MI')
        END AS total_hours,

        TO_CHAR(
          COALESCE(a.expected_hours, INTERVAL '9 hours'),
          'HH24:MI'
        ) AS expected_hours,

        CASE
          WHEN u.is_active = FALSE THEN 'Inactive'
          WHEN a.emp_id IS NULL THEN 'Absent'
          ELSE a.status
        END AS status

      FROM users u
      LEFT JOIN daily_attendance a
        ON a.emp_id = u.emp_id
       AND a.attendance_date =
         (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE

      WHERE u.role = 'employee'
      ORDER BY u.name;
    `);

    res.status(200).json(rows);
  } catch (error) {
    console.error("❌ Attendance fetch error:", error);
    res.status(500).json({ message: "Failed to fetch today's attendance" });
  }
};


function intervalToHHMM(total_hours) {
  if (!total_hours) return "00:00";

  // Case  already string "HH:MM"
  if (typeof total_hours === "string") {
    return total_hours;
  }

  // Case  PostgreSQL INTERVAL object
  const h = total_hours.hours || 0;
  const m = total_hours.minutes || 0;
  const s = total_hours.seconds || 0;

  const totalSeconds = h * 3600 + m * 60 + s;
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);

  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

exports.getMyTodayAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;

    let today = null;
    let todayHours = "00:00";

    /* -------------------------------------------------
     TODAY ATTENDANCE (DAILY_ATTENDANCE)
    --------------------------------------------------*/
    const dailyResult = await db.query(
      `
      SELECT punch_in, punch_out, total_hours, status
      FROM daily_attendance
      WHERE emp_id = $1
        AND attendance_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
      LIMIT 1
      `,
      [empId]
    );

    if (dailyResult.rows.length > 0) {
      today = dailyResult.rows[0];
      todayHours = intervalToHHMM(today.total_hours);
    }

    
    if (!today) {
      const liveResult = await db.query(
        `
        WITH today_logs AS (
          SELECT
            MIN(punch_time AT TIME ZONE 'Asia/Kolkata') AS punch_in,
            MAX(punch_time AT TIME ZONE 'Asia/Kolkata') AS punch_out
          FROM activity_log
          WHERE emp_id = $1
            AND (punch_time AT TIME ZONE 'Asia/Kolkata')::DATE =
                (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
        )
        SELECT
          punch_in,
          CASE
            WHEN punch_in IS NULL THEN NULL
            WHEN punch_out = punch_in THEN NULL
            ELSE punch_out
          END AS punch_out,
          CASE
            WHEN punch_in IS NULL THEN 'Absent'
            WHEN punch_out = punch_in THEN 'Working'
            ELSE 'Present'
          END AS status,
          CASE
            WHEN punch_in IS NULL THEN INTERVAL '0'
            WHEN punch_out = punch_in
              THEN (NOW() AT TIME ZONE 'Asia/Kolkata') - punch_in
            ELSE punch_out - punch_in
          END AS total_hours
        FROM today_logs
        `,
        [empId]
      );

      today = liveResult.rows[0];
      todayHours = intervalToHHMM(today?.total_hours);
    }


    
    const weeklyResult = await db.query(
      `
  WITH week_bounds AS (
    SELECT
      DATE_TRUNC('week', (NOW() AT TIME ZONE 'Asia/Kolkata'))::date AS week_start,
      ((NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day')::date AS week_end
  ),

  daily_logs AS (
    SELECT
      (punch_time AT TIME ZONE 'Asia/Kolkata')::date AS work_date,
      MIN(punch_time AT TIME ZONE 'Asia/Kolkata') AS punch_in,
      MAX(punch_time AT TIME ZONE 'Asia/Kolkata') AS punch_out
    FROM activity_log
    WHERE emp_id = $1
    GROUP BY (punch_time AT TIME ZONE 'Asia/Kolkata')::date
  )

  SELECT
    COALESCE(
      SUM(
        EXTRACT(EPOCH FROM (dl.punch_out - dl.punch_in))
      ),
      0
    ) AS total_seconds
  FROM daily_logs dl, week_bounds wb
  WHERE dl.work_date BETWEEN wb.week_start AND wb.week_end
    AND dl.punch_in IS NOT NULL
    AND dl.punch_out IS NOT NULL
    AND dl.punch_out > dl.punch_in
  `,
      [empId]
    );

    const weeklySeconds = Number(weeklyResult.rows[0].total_seconds || 0);
    const weeklyHrs = Math.floor(weeklySeconds / 3600);
    const weeklyMins = Math.floor((weeklySeconds % 3600) / 60);


    
    res.json({
      today: {
        punch_in: today?.punch_in ?? null,
        punch_out: today?.punch_out ?? null,
        total_hours: todayHours,
        status: today?.status ?? "Absent",
      },
      weekly: {
        total_hours: `${String(weeklyHrs).padStart(2, "0")}:${String(
          weeklyMins
        ).padStart(2, "0")}`,
      },
    });
  } catch (err) {
    console.error("❌ getMyTodayAttendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Device → activity_log (every punch, real time)
//         ↓
// Cron / Trigger (every 5–15 min OR after sync)
//         ↓
// daily_attendance (refreshed snapshot for today)
//         ↓
// UI






// /*  Employee – All  attendance */ 
exports.getMyAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;

    // Store last 2 days from activity_log into daily_attendance if not already present
    await db.query(`
      INSERT INTO daily_attendance (emp_id, attendance_date, punch_in, punch_out, expected_hours)
      SELECT
        emp_id,
        attendance_date,
        MIN(local_time) FILTER (WHERE local_time::time >= TIME '10:00') AS punch_in,
        MAX(local_time) AS punch_out,
        NULL AS expected_hours
      FROM (
        SELECT
          emp_id,
          punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
          CASE
            WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00'
            THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
            ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date
          END AS attendance_date
        FROM activity_log
        WHERE emp_id = $1
          AND (punch_time AT TIME ZONE 'Asia/Kolkata')::date >= CURRENT_DATE - INTERVAL '2 day'
      ) t
      GROUP BY emp_id, attendance_date
      ON CONFLICT (emp_id, attendance_date) DO NOTHING; -- avoid duplicates
    `, [empId]);

    //  Fetch attendance for current month
    const { rows } = await db.query(`
      WITH dates AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE)::date,
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS attendance_date
      ),

      /* =======================
         ACTIVITY LOG (PRIMARY)
      ========================*/
      activity_data AS (
        SELECT
          emp_id,
          attendance_date,
          MIN(local_time) FILTER (WHERE local_time::time >= TIME '10:00') AS punch_in,
          MAX(local_time) AS punch_out
        FROM (
          SELECT
            emp_id,
            punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
            CASE
              WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00'
              THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
              ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date
            END AS attendance_date
          FROM activity_log
          WHERE emp_id = $1
        ) t
        GROUP BY emp_id, attendance_date
      ),

      /* =========================
         DAILY ATTENDANCE
      ==========================*/
      daily_attendance_data AS (
        SELECT *
        FROM daily_attendance
        WHERE emp_id = $1
      ),

      /* =========================
         ATTENDANCE LOG (FALLBACK)
      ==========================*/
      attendance_log_data AS (
        SELECT
          emp_id,
          attendance_date,
          MIN(local_time) AS punch_in,
          MAX(local_time) AS punch_out
        FROM (
          SELECT
            emp_id,
            punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
            CASE
              WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00'
              THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
              ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date
            END AS attendance_date
          FROM attendance_logs
          WHERE emp_id = $1
        ) x
        GROUP BY emp_id, attendance_date
      )

      SELECT
        $1 AS emp_id,
        u.name AS employee_name,
        to_char(d.attendance_date, 'YYYY-MM-DD') AS attendance_date,

        /* Punch In priority: activity → daily → log */
        COALESCE(ad.punch_in, da.punch_in, al.punch_in) AS punch_in,

        /* Punch Out priority: activity → daily → log */
        COALESCE(ad.punch_out, da.punch_out, al.punch_out) AS punch_out,

        /* Total seconds */
        CASE
          WHEN COALESCE(ad.punch_in, da.punch_in, al.punch_in) IS NOT NULL
           AND COALESCE(ad.punch_out, da.punch_out, al.punch_out) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (
            COALESCE(ad.punch_out, da.punch_out, al.punch_out)
            - COALESCE(ad.punch_in, da.punch_in, al.punch_in)
          ))
          ELSE NULL
        END AS total_seconds,

        da.expected_hours,

        /* Status */
        CASE
          WHEN COALESCE(ad.punch_in, da.punch_in, al.punch_in) IS NULL THEN 'Absent'
          WHEN COALESCE(ad.punch_out, da.punch_out, al.punch_out) IS NULL THEN 'Working'
          ELSE 'Present'
        END AS status

      FROM dates d
      LEFT JOIN activity_data ad
        ON ad.emp_id = $1
       AND ad.attendance_date = d.attendance_date

      LEFT JOIN daily_attendance_data da
        ON da.emp_id = $1
       AND da.attendance_date = d.attendance_date

      LEFT JOIN attendance_log_data al
        ON al.emp_id = $1
       AND al.attendance_date = d.attendance_date

      JOIN users u ON u.emp_id = $1
      ORDER BY d.attendance_date DESC;
    `, [empId]);

    // Convert seconds → hours/minutes
    const formatted = rows.map(r => {
      let total_hours = null;
      if (r.total_seconds !== null) {
        const secs = Number(r.total_seconds);
        total_hours = {
          hours: Math.floor(secs / 3600),
          minutes: Math.floor((secs % 3600) / 60)
        };
      }
      return { ...r, total_hours };
    });

    res.status(200).json({
      total_documents: formatted.length,
      attendance: formatted
    });

  } catch (err) {
    console.error("❌ getMyAttendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};






// exports.getMyAttendance = async (req, res) => {
//   try {
//     const empId = req.user.emp_id;

//     const { rows } = await db.query(
//       `
//       WITH dates AS (
//         SELECT generate_series(
//           date_trunc('month', CURRENT_DATE)::date,
//           CURRENT_DATE,
//           INTERVAL '1 day'
//         )::date AS attendance_date
//       ),

//       /* -------- FIRST PUNCH AFTER 10 AM IST -------- */
//       first_punch AS (
//         SELECT
//           emp_id,
//           (punch_time AT TIME ZONE 'Asia/Kolkata')::date AS attendance_date,

//           -- FIRST punch AFTER 10 AM only
//           MIN(punch_time) FILTER (
//             WHERE (punch_time AT TIME ZONE 'Asia/Kolkata')::time >= TIME '10:00'
//           ) AS punch_in

//         FROM activity_log
//         WHERE emp_id = $1
//         GROUP BY emp_id, (punch_time AT TIME ZONE 'Asia/Kolkata')::date
//       ),

//       /* -------- LAST PUNCH OF DAY -------- */
//       last_punch AS (
//         SELECT
//           emp_id,
//           (punch_time AT TIME ZONE 'Asia/Kolkata')::date AS attendance_date,
//           MAX(punch_time) AS punch_out
//         FROM activity_log
//         WHERE emp_id = $1
//         GROUP BY emp_id, (punch_time AT TIME ZONE 'Asia/Kolkata')::date
//       ),

//       /* -------- UPDATE DAILY ATTENDANCE -------- */
//       updated_attendance AS (
//         UPDATE daily_attendance da
//         SET
//           punch_in  = fp.punch_in,
//           punch_out = lp.punch_out,

//           total_hours =
//             CASE
//               WHEN fp.punch_in IS NOT NULL
//                AND lp.punch_out IS NOT NULL
//               THEN lp.punch_out - fp.punch_in
//               ELSE NULL
//             END,

//           status =
//             CASE
//               WHEN fp.punch_in IS NULL THEN 'Absent'
//               WHEN lp.punch_out IS NULL THEN 'Working'
//               ELSE 'Present'
//             END

//         FROM first_punch fp
//         LEFT JOIN last_punch lp
//           ON lp.emp_id = fp.emp_id
//          AND lp.attendance_date = fp.attendance_date
//         WHERE da.emp_id = fp.emp_id
//           AND da.attendance_date = fp.attendance_date
//         RETURNING da.*
//       )

//       /* -------- FINAL RESPONSE -------- */
//       SELECT
//         $1 AS emp_id,
//         u.name AS employee_name,
//         d.attendance_date,

//         -- ❌ NO timezone conversion here
//         da.punch_in,
//         da.punch_out,

//         CASE
//           WHEN da.punch_in IS NOT NULL
//            AND da.punch_out IS NOT NULL
//           THEN EXTRACT(EPOCH FROM (da.punch_out - da.punch_in))
//           ELSE NULL
//         END AS total_seconds,

//         da.expected_hours,

//         CASE
//           WHEN da.punch_in IS NULL THEN 'Absent'
//           WHEN da.punch_out IS NULL THEN 'Working'
//           ELSE 'Present'
//         END AS status

//       FROM dates d
//       LEFT JOIN daily_attendance da
//         ON da.emp_id = $1
//        AND da.attendance_date = d.attendance_date
//       JOIN users u
//         ON u.emp_id = $1
//       ORDER BY d.attendance_date DESC
//       `,
//       [empId]
//     );

//     /* -------- FORMAT HOURS FOR UI -------- */
//     const formatted = rows.map(r => {
//       let total_hours = null;

//       if (r.total_seconds !== null) {
//         const secs = Number(r.total_seconds);
//         total_hours = {
//           hours: Math.floor(secs / 3600),
//           minutes: Math.floor((secs % 3600) / 60),
//         };
//       }

//       return {
//         ...r,
//         total_hours,
//       };
//     });

//     res.status(200).json({
//       total_documents: formatted.length,
//       attendance: formatted,
//     });

//   } catch (err) {
//     console.error("❌ getMyAttendance error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };







exports.getMyHolidays = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM holidays ORDER BY holiday_date ASC`
    );

    res.status(200).json(rows);
  } catch (err) {
    console.error("getMyHolidays error:", err);
    res.status(500).json({ message: "Server error" });
  }
};




























