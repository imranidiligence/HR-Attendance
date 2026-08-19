const { db } = require("../db/connectDB");
require("dotenv").config();
const { getDeviceAttendance } = require("../services/zk.service");
const sendEmail = require("../utils/mailer");
const cron = require('node-cron');
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");
const env = process.env.NODE_ENV;


// Pick the correct file
const envFile = env === "production" ? ".env.production" : ".env.local";

// console.log("envFile Attendance", envFile);
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Determine admin emails dynamically
const adminEmails = process.env.NODE_ENV === "production"
  ? process.env.PROD_ADMIN_EMAILS  // from .env.production
  : process.env.LOCAL_ADMIN_EMAILS; // from .env.local

const ccEmails = process.env.NODE_ENV === "production"
  ? process.env.PROD_CC_EMAILS || "" // optional, can also fetch from DB if needed
  : process.env.LOCAL_CC_EMAILS;

// console.log("Admin Emails:", adminEmails);
// console.log("CC Emails:", ccEmails);

/* Sync machine logs */
exports.syncAttendance = async (req, res) => {
  await getDeviceAttendance();
  res.json({ message: "Machine logs synced" });
};

exports.getAdminMyAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;

    // 1. Sync recent activity (No changes here, remains efficient)
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

    // 2. Fetch attendance with Working Hours Calculation
    const { rows } = await db.query(`
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days', 
          CURRENT_DATE, 
          INTERVAL '1 day'
        )::date AS attendance_date
      ),
      activity_data AS (
        SELECT emp_id, attendance_date,
               MIN(local_time) FILTER (WHERE local_time::time >= TIME '10:00') AS punch_in,
               MAX(local_time) AS punch_out
        FROM (
          SELECT emp_id, punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
          CASE WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00' 
               THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
               ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date END AS attendance_date
          FROM activity_log WHERE emp_id = $1
        ) t GROUP BY emp_id, attendance_date
      ),
      attendance_log_data AS (
        SELECT emp_id, attendance_date, MIN(local_time) AS punch_in, MAX(local_time) AS punch_out
        FROM (
          SELECT emp_id, punch_time AT TIME ZONE 'Asia/Kolkata' AS local_time,
          CASE WHEN (punch_time AT TIME ZONE 'Asia/Kolkata')::time < TIME '04:00' 
               THEN (punch_time AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '1 day'
               ELSE (punch_time AT TIME ZONE 'Asia/Kolkata')::date END AS attendance_date
          FROM attendance_logs WHERE emp_id = $1
        ) x GROUP BY emp_id, attendance_date
      )
    SELECT 
  $1 AS emp_id,
  u.name AS employee_name,
  to_char(d.attendance_date, 'YYYY-MM-DD') AS attendance_date,
  COALESCE(ad.punch_in, da.punch_in, al.punch_in) AS punch_in,
  COALESCE(ad.punch_out, da.punch_out, al.punch_out) AS punch_out,
  -- CALCULATE WORKING HOURS
  (COALESCE(ad.punch_out, da.punch_out, al.punch_out) - COALESCE(ad.punch_in, da.punch_in, al.punch_in)) AS total_hours,
  CASE 
    -- If there is no punch_in at all, they are Absent
    WHEN COALESCE(ad.punch_in, da.punch_in, al.punch_in) IS NULL THEN 'Absent'
    
    -- If they have a punch_in, they are Present 
    -- (This covers 'Working', 'Present', and same-time punches)
    ELSE 'Present'
  END AS status
FROM dates d
JOIN users u ON u.emp_id = $1
LEFT JOIN activity_data ad ON ad.attendance_date = d.attendance_date
LEFT JOIN daily_attendance da ON da.attendance_date = d.attendance_date AND da.emp_id = $1
LEFT JOIN attendance_log_data al ON al.attendance_date = d.attendance_date
WHERE u.is_active = true  -- Ensuring only active users are processed
ORDER BY d.attendance_date DESC;
    `, [empId]);

    // 3. Format result for Frontend (consistent with your table row logic)
    const formattedData = rows.map(r => {
      const formatTime = (isoStr) => {
        if (!isoStr) return '---';
        return new Date(isoStr).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
        });
      };

      // Handle PostgreSQL interval object correctly
      const hours = r.total_hours?.hours || 0;
      const minutes = r.total_hours?.minutes || 0;

      return {
        ...r,
        punch_in: formatTime(r.punch_in),
        punch_out: formatTime(r.punch_out),
        total_hours_str: `${hours}h ${minutes}m`
      };
    });

    res.status(200).json({
      total_documents: formattedData.length,
      attendance: formattedData
    });

  } catch (err) {
    console.error("❌ getAdminMyAttendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.addEmployController = async (req, res) => {

  const client = await db.connect();

  console.log("addEmp", req.body)

  // FrontendData
  // addEmp {
  //   name: 'john',
  //   role: 'employee',
  //   email: 'john@gmail.com',
  //   emp_id: '12345',
  //   profile_image: 'blob:http://localhost:5173/7aa33e42-9c92-4f86-b81b-febcf0485a54',
  //   password: '123456',
  //   current_address: 'xyz'
  // }


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
      designation,
      joining_date,
      maritalstatus,
      nominee,
      aadharnumber,
      bloodgroup,
      nationality,
      employee_type,
      current_address,
      reporting_location,
      is_active
    } = req.body;


    console.log(name, email, password, emp_id);

    // 1. Validation
    if (!name || !email || !password || !emp_id) {
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
        shift_id || 3,
        profile_image,
      ]
    );

    const newUserId = userResult.rows[0].id;

    // 5. Insert into 'personal' table
    await client.query(
      `
      INSERT INTO personal 
        (emp_id, department, designation, joining_date, employee_type, reporting_location, current_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        newUserId,
        department,
        designation,
        joining_date || null,
        employee_type,
        reporting_location,
        current_address,
      ]
    );

    // await client.query(
    //   `
    //   INSERT INTO personal 
    //     (emp_id, dob, gender, department, joining_date, maritalstatus, nominee, aadharnumber, bloodgroup, nationality, current_address)
    //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    //   `,
    //   [
    //     newUserId,
    //     dob || null,
    //     gender,
    //     department,
    //     joining_date || null,
    //     maritalstatus,
    //     nominee,
    //     aadharnumber,
    //     bloodgroup,
    //     nationality,
    //     current_address,
    //   ]
    // );



    // 6. Commit Transaction
    await client.query("COMMIT");


    // await sendEmail(email, "Welcome to the Company", "employee_creation", { name, emp_id, email });


    res.status(201).json({
      message: "Employee created successfully",
      user: { id: newUserId, emp_id, name, email,role },
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

    // Dashboard counts
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



// 2.0

exports.runAttendanceTask = async () => {
  try {
    console.log(`[${new Date().toISOString()}] CRON: Triggering processAndSendAttendanceReport...`);

    // Pass 'true' so the email actually sends during the cron run
    const data = await exports.processAndSendAttendanceReport(true);

    console.log(`[${new Date().toISOString()}] CRON: Success. Processed ${data.length} records.`);
  } catch (error) {
    // This catch block is vital so a database error doesn't crash your whole Node app
    console.error(`[${new Date().toISOString()}] CRON ERROR:`, error);
  }
};



// Reusable logic: handles DB sync, Emailing (if flag is true), and Data Return
const formatInterval = (interval) => {
  if (!interval) return "0h 0m";

  const hours = interval.hours || 0;
  const minutes = interval.minutes || 0;

  return `${hours}h ${minutes}m`;
};

exports.processAndSendAttendanceReport = async (sendEmailToAdmin = false, req = null, res = null) => {
  try {
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    console.log("env", env);
    const query = `
                WITH attendance_summary AS (
                  SELECT
                      da.emp_id,
                      da.attendance_date,

                      COUNT(*) AS punch_count,

                      MIN(da.punch_in) AS first_punch,
                      -- change here 
                    MAX(
                CASE
                  WHEN da.punch_out = da.punch_in THEN NULL
                  ELSE da.punch_out
                END
              ) AS last_punch,

                      /*  Correct total hours calculation (session-wise sum) */
                    COALESCE(
                  SUM(
                      CASE 
                          WHEN da.punch_out IS NOT NULL 
                          THEN da.punch_out - da.punch_in
                          ELSE INTERVAL '0'
                      END
                  ),
                  INTERVAL '0 hours'
              ) AS total_hours

                  FROM public.daily_attendance da
                  WHERE da.attendance_date = $1
                  GROUP BY da.emp_id, da.attendance_date
              )

              SELECT
                  u.emp_id,
                  u.name,
                  u.email,
                  u.is_active,
                  p.department,
                  p.joining_date,

                  COALESCE(a.attendance_date, $1::DATE) AS attendance_date,

                  a.first_punch AS punch_in,
                  a.last_punch AS punch_out,

                  /*  Clean Status Logic */
                  CASE
                      WHEN a.punch_count IS NULL THEN 'Absent'
                      WHEN a.punch_count >= 1 AND a.last_punch IS NULL THEN 'Working'
                      WHEN a.punch_count >= 1 THEN 'Present'
                      ELSE 'Absent'
                  END AS status,

                  COALESCE(a.punch_count, 0) AS punch_count,

                  COALESCE(a.total_hours, INTERVAL '0 hours') AS total_hours

              FROM users u
              LEFT JOIN personal p ON u.emp_id = p.emp_id
              LEFT JOIN attendance_summary a ON u.emp_id = a.emp_id

              WHERE u.role IN ('employee', 'admin')

              ORDER BY u.is_active DESC, u.name ASC;
`;

    const { rows } = await db.query(query, [todayIST]);

    const mailDateFormat = new Date().toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');


    dotenv.config({ path: process.env.NODE_ENV === "production" ? ".env.production" : ".env.local" });
    // --- EMAIL LOGIC ---
    // Only runs when triggered by Cron (passing true)
    if (sendEmailToAdmin) {
      // const adminEmails = "hradmin@i-diligence.com,s.hanif@i-diligence.com,s.imran@i-diligence.com"; 
      // const adminEmails = "s.imran@i-diligence.com"
      // const ccEmails = "s.irfan@i-diligence.com";
      // const adminEmails = process.env.NODE_ENV === "production"
      //   ? process.env.PROD_ADMIN_EMAILS
      //   : process.env.LOCAL_ADMIN_EMAILS;

      // const ccEmails = process.env.NODE_ENV === "production"
      //   ? process.env.PROD_CC_EMAILS || ""
      //   : process.env.LOCAL_CC_EMAILS;
      const subject = `Attendance Report - ${mailDateFormat}`;

      // Fetch from DB
      const type = process.env.NODE_ENV === "production" ? "production" : "local";

      const emailResult = await db.query(
        `SELECT email FROM "EmployeeEmail" WHERE type = $1`,
        [type]
      );

      // console.log(first)
      const row = emailResult.rows;

      // console.log("AdminEmail Row", row);

      const adminEmails =  emailResult.rows.map(r => r.email?.trim())
          .filter(Boolean)
          .join(",")
    

      // console.log("process.env.NODE_ENV",process.env.NODE_ENV)

      console.log("adminEmails",adminEmails);

      // Generate HTML rows for the email

      // console.log("rows",rows)
      const tableRowsHtml = rows
        .filter(emp => emp.is_active && emp.emp_id && emp.emp_id !== "2020")
        .map(emp => {

          // console.log("emp",emp)
          // 1. Status Colors (Backgrounds)
          const statusBg = emp.status === 'Working' ? '#ff9800' : (emp.status === 'Absent' ? '#dc3545' : '#28a745');

          // 2. Format Times & Date
          const timeIn = emp.punch_in
            ? new Date(emp.punch_in).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
            : '---';

          const timeOut = emp.punch_out
            ? new Date(emp.punch_out).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
            : '---';



          // const attendanceDate = emp.punch_in 
          //   ? new Date(emp.punch_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' })
          //   : '---';

          const attendanceDate = emp.punch_in
            ? new Date(emp.punch_in).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }).replace(/\//g, '-')
            : '---';

          // 3. Return Table Row

          // console.log("emp",emp)
          return `
          <tr>
            <td style="border:1px solid #ddd; padding:8px;">${emp.emp_id}</td>
            <td style="border:1px solid #ddd; padding:8px;">${emp.name}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${attendanceDate}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${timeIn}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${timeOut}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${formatInterval(emp.total_hours) || '0h 0m'}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: center; vertical-align: middle;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 90px;">
    <tr>
      <td 
        style="background-color: ${statusBg}; padding: 6px 0; border-radius: 20px; font-family: Arial, sans-serif; text-align: center; width: 90px;" 
        bgcolor="${statusBg}"
      >
        <div style="color: #ffffff; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; line-height: 1; white-space: nowrap;">
          ${emp.status}
        </div>
      </td>
    </tr>
  </table>
</td>
          </tr>`;
        }).join('');

      // console.log("rows",rows)
      const now = new Date();
      const formattedDate = now
        .toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Kolkata'
        })
        .replace(/\//g, '-');

      console.log("adminEmail Send Mail",adminEmails);

      // console.log(formattedDate);
      await sendEmail(
        adminEmails,
        subject,
        "admin_all_present",
        {
          date: formattedDate,
          time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
          employee_rows: tableRowsHtml
        },
        ccEmails
      );
      console.log("CRON: Email sent successfully.");
    }

    // Handle API Response vs Cron return
    if (res) return res.status(200).json(rows);
    return rows;

  } catch (error) {
    console.error("Attendance Process Error:", error);
    if (res) return res.status(500).json({ message: "Internal Server Error" });
    throw error;
  }
};


exports.getTodayOrganizationAttendance = async (req, res) => {
  try {

    const data = await exports.processAndSendAttendanceReport(false);
    res.status(200).json(data);
  } catch (error) {
    console.error("Manual report error:", error);
    res.status(500).json({ message: "Failed to process attendance" });
  }
};



// cron.schedule('0 11,16,21 * * 1-6', async () => {
//   console.log(`[${new Date().toISOString()}] Starting hourly attendance report...`);
//   const now = new Date();

//   console.log("=================================");
//   console.log("CRON START");
//   console.log("TIME:", now.toLocaleString());
//   console.log("PID:", process.pid);
//   console.log("=================================");
//   await exports.runAttendanceTask();
// }, {
//   scheduled: true,
//   timezone: "Asia/Kolkata"
// });
//  exports.runAttendanceTask();

// cron.schedule('5 15 * * 1-6', async () => {
//   console.log(`[${new Date().toISOString()}] Starting  attendance report...`);
//   const now = new Date();

//   console.log("=================================");
//   console.log("CRON START");
//   console.log("TIME:", now.toLocaleString());
//   console.log("PID:", process.pid);
//   console.log("=================================");
//   await exports.runAttendanceTask();
// }, {
//   scheduled: true,
//   timezone: "Asia/Kolkata"
// });


// cron.schedule('4 12 * * *', async () => {
//   console.log(`[${new Date().toISOString()}] Starting 8:30 PM attendance report...`);
//   exports.runAttendanceTask();
// }, {
//   scheduled: true,
//   timezone: "Asia/Kolkata"
// });




// single Emp Attendance



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

// Single Employee Attendance
exports.getMyTodayAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;

    const formatTime = (ts) => {
      if (!ts) return null;
      const date = new Date(ts);
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };

    const secondsToHHMM = (seconds) => {
      const total = Number(seconds || 0);
      const hrs = Math.floor(total / 3600);
      const mins = Math.floor((total % 3600) / 60);
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    };


    const todayResult = await db.query(
      `
    SELECT 
    punch_in,

    CASE
        WHEN punch_out = punch_in THEN NULL
        ELSE punch_out
    END AS punch_out,

    CASE
        WHEN punch_in IS NULL THEN 'Absent'
        WHEN punch_out IS NULL OR punch_out = punch_in THEN 'Working'
        ELSE 'Present'
    END AS status,

   CASE
    WHEN punch_out IS NULL OR punch_out = punch_in THEN '00:00'
    ELSE TO_CHAR(punch_out - punch_in, 'HH24:MI')
END AS total_hours


FROM daily_attendance
WHERE emp_id = $1
AND attendance_date = CURRENT_DATE
LIMIT 1;
      `,
      [empId]
    );

    let today;

    if (todayResult.rows.length > 0) {
      const row = todayResult.rows[0];

      today = {
        punch_in: formatTime(row.punch_in),
        punch_out: formatTime(row.punch_out),
        total_hours: row.total_hours,
        status: row.status || "Absent",
      };
    } else {
      // fallback from activity_log (if daily record not created yet)

      const liveResult = await db.query(
        `
        SELECT
          MIN(punch_time) AS punch_in,
          MAX(punch_time) AS punch_out
        FROM activity_log
        WHERE emp_id = $1
          AND punch_time::date = CURRENT_DATE
        `,
        [empId]
      );

      const row = liveResult.rows[0];

      if (!row.punch_in) {
        today = {
          punch_in: null,
          punch_out: null,
          total_hours: "00:00",
          status: "Absent",
        };
      } else {
        const totalSeconds =
          row.punch_out && row.punch_out !== row.punch_in
            ? (new Date(row.punch_out) - new Date(row.punch_in)) / 1000
            : (new Date() - new Date(row.punch_in)) / 1000;

        today = {
          punch_in: formatTime(row.punch_in),
          punch_out:
            row.punch_out !== row.punch_in
              ? formatTime(row.punch_out)
              : null,
          total_hours: secondsToHHMM(totalSeconds),
          status:
            row.punch_out && row.punch_out !== row.punch_in
              ? "Present"
              : "Working",
        };
      }
    }


    const weeklyResult = await db.query(
      `
      SELECT 
        COALESCE(
          SUM(EXTRACT(EPOCH FROM (punch_out - punch_in))),
          0
        ) AS total_seconds
      FROM daily_attendance
      WHERE emp_id = $1
        AND attendance_date >= DATE_TRUNC('week', CURRENT_DATE)
        AND attendance_date <= CURRENT_DATE
        AND punch_in IS NOT NULL
        AND punch_out IS NOT NULL
      `,
      [empId]
    );

    const weeklySeconds = weeklyResult.rows[0].total_seconds;

    res.json({
      today,
      weekly: {
        total_hours: secondsToHHMM(weeklySeconds),
      },
    });

  } catch (err) {
    console.error("getMyTodayAttendance error:", err);
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



exports.getMyAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;

   const { rows } = await db.query(`
WITH date_range AS (
  SELECT generate_series(
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '30 days',
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
    '1 day'
  )::date AS attendance_date
),

logs_summary AS (
  SELECT
    emp_id,
    DATE(punch_time) AS attendance_date,
    MIN(punch_time) AS log_punch_in,
    MAX(punch_time) AS log_punch_out,
    COUNT(*) AS total_logs
  FROM attendance_logs
  WHERE emp_id = $1
  GROUP BY emp_id, DATE(punch_time)
)

SELECT 
  $1 AS emp_id,
  u.name AS employee_name,
  to_char(dr.attendance_date, 'YYYY-MM-DD') AS attendance_date,

  -- Punch In
  COALESCE(da.punch_in, ls.log_punch_in) AS punch_in,

  -- Punch Out Logic
  CASE
    WHEN da.punch_out IS NOT NULL THEN da.punch_out
    WHEN ls.total_logs > 1 THEN ls.log_punch_out
    ELSE NULL
  END AS punch_out,

  -- Total Seconds
  CASE 
    WHEN COALESCE(da.punch_in, ls.log_punch_in) IS NULL THEN 0
    
    WHEN (
      CASE
        WHEN da.punch_out IS NOT NULL THEN da.punch_out
        WHEN ls.total_logs > 1 THEN ls.log_punch_out
        ELSE NULL
      END
    ) IS NULL THEN 0

    ELSE EXTRACT(EPOCH FROM (
      (
        CASE
          WHEN da.punch_out IS NOT NULL THEN da.punch_out
          WHEN ls.total_logs > 1 THEN ls.log_punch_out
          ELSE NULL
        END
      ) - COALESCE(da.punch_in, ls.log_punch_in)
    ))
  END AS total_seconds,

  -- Status
  CASE
    WHEN COALESCE(da.punch_in, ls.log_punch_in) IS NULL 
      THEN 'Absent'

    WHEN (
      CASE
        WHEN da.punch_out IS NOT NULL THEN da.punch_out
        WHEN ls.total_logs > 1 THEN ls.log_punch_out
        ELSE NULL
      END
    ) IS NULL
      THEN 'Working'

    ELSE 'Present'
  END AS status

FROM date_range dr

CROSS JOIN (
  SELECT name 
  FROM users 
  WHERE emp_id = $1
) u

LEFT JOIN daily_attendance da
  ON da.emp_id = $1
 AND da.attendance_date = dr.attendance_date

LEFT JOIN logs_summary ls
  ON ls.emp_id = $1
 AND ls.attendance_date = dr.attendance_date

ORDER BY dr.attendance_date DESC;
`, [empId]);

    // Main query with better punch out logic and activity_log fallback
    // const { rows } = await db.query(`
    // WITH date_range AS (
    //   SELECT generate_series(
    //     (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '30 days',
    //     (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
    //     '1 day'
    //   )::date AS attendance_date
    // ),

    // logs_summary AS (
    //   SELECT
    //     emp_id,
    //     DATE(punch_time) AS attendance_date,
    //     MIN(punch_time) AS punch_in,
    //     CASE 
    //       WHEN COUNT(*) > 1 THEN MAX(punch_time)
    //       ELSE NULL
    //     END AS punch_out
    //   FROM attendance_logs
    //   WHERE emp_id = $1
    //   GROUP BY emp_id, DATE(punch_time)
    // )

    // SELECT 
    //   $1 AS emp_id,
    //   u.name AS employee_name,
    //   to_char(dr.attendance_date, 'YYYY-MM-DD') AS attendance_date,

    //   COALESCE(da.punch_in, ls.punch_in) AS punch_in,
    //   COALESCE(da.punch_out, ls.punch_out) AS punch_out,

    //   CASE 
    //     WHEN COALESCE(da.punch_in, ls.punch_in) IS NULL THEN 0
    //     WHEN COALESCE(da.punch_out, ls.punch_out) IS NULL THEN 0
    //     ELSE EXTRACT(EPOCH FROM (
    //       COALESCE(da.punch_out, ls.punch_out) - 
    //       COALESCE(da.punch_in, ls.punch_in)
    //     ))
    //   END AS total_seconds,

    // CASE

    //   -- Absent
    //   WHEN COALESCE(da.punch_in, ls.punch_in) IS NULL THEN 'Absent'

    //   -- Working (punched in but no punch out today)
    //   WHEN COALESCE(da.punch_in, ls.punch_in) IS NOT NULL
    //        AND COALESCE(da.punch_out, ls.punch_out) IS NULL
    //        AND dr.attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    //   THEN 'Working'

    //   -- Late Come (after 10:00)
    //   WHEN COALESCE(da.punch_in, ls.punch_in)::time > time '10:00:00'
    //   THEN 'Late Come'

    //   -- Early Go
    //   WHEN COALESCE(da.punch_out, ls.punch_out) IS NOT NULL
    //        AND COALESCE(da.punch_out, ls.punch_out) <
    //            (
    //              COALESCE(da.punch_in, ls.punch_in) +
    //              INTERVAL '7:30 hours'
    //            )
    //   THEN 'Early Go'

    //   -- Present
    //   WHEN EXTRACT(EPOCH FROM (
    //         COALESCE(da.punch_out, ls.punch_out) -
    //         COALESCE(da.punch_in, ls.punch_in)
    //        )) >= (8 * 3600 - 600)
    //   THEN 'Present'

    //   ELSE 'Absent'

    // END AS status

    // FROM date_range dr

    // CROSS JOIN (SELECT name FROM users WHERE emp_id = $1) u

    // LEFT JOIN daily_attendance da
    //   ON da.emp_id = $1
    //  AND da.attendance_date = dr.attendance_date

    // LEFT JOIN logs_summary ls
    //   ON ls.emp_id = $1
    //  AND ls.attendance_date = dr.attendance_date

    // ORDER BY dr.attendance_date DESC;
    // `, [empId]);

//     const { rows } = await db.query(`
// WITH emp_data AS (
//   SELECT 
//     u.emp_id,
//     u.name,
//     s.start_time,
//     s.end_time,
//     s.name AS shift_name,
//     ws.working_days,

//     -- Detect Night Shift
//     CASE 
//       WHEN s.start_time > s.end_time THEN true
//       ELSE false
//     END AS is_night_shift

    

//   FROM users u
//   LEFT JOIN shifts s ON u.shift_id = s.id
//   LEFT JOIN weekly_schedules ws ON u.shift_id = ws.id
//   WHERE u.emp_id = $1
// ),

// date_range AS (
//   SELECT generate_series(
//     (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '30 days',
//     (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date,
//     '1 day'
//   )::date AS attendance_date
// ),

// logs_with_shift_date AS (
//   SELECT
//     l.emp_id,

//     --  FIXED attendance date
//     CASE 
//       WHEN ed.is_night_shift = true 
//            AND l.punch_time::time < ed.end_time
//       THEN (l.punch_time::date - INTERVAL '1 day')::date
//       ELSE l.punch_time::date
//     END AS attendance_date,

//     l.punch_time

//   FROM attendance_logs l
//   JOIN emp_data ed ON ed.emp_id = l.emp_id
//   WHERE l.emp_id = $1
// ),

// logs_summary AS (
//   SELECT
//     emp_id,
//     attendance_date,
//     MIN(punch_time) AS punch_in,
//     CASE 
//       WHEN COUNT(*) > 1 THEN MAX(punch_time)
//       ELSE NULL
//     END AS punch_out
//   FROM logs_with_shift_date
//   GROUP BY emp_id, attendance_date
// )

// SELECT 
//   ed.emp_id,
//   ed.name AS employee_name,
//   to_char(dr.attendance_date, 'YYYY-MM-DD') AS attendance_date,

//   ls.punch_in,
//   ls.punch_out,

//   ed.shift_name,

//   -- Work seconds
//   CASE 
//     WHEN ls.punch_in IS NULL THEN 0
//     WHEN ls.punch_out IS NULL THEN 0
//     ELSE EXTRACT(EPOCH FROM (ls.punch_out - ls.punch_in))
//   END AS total_seconds,
// CASE 
//   WHEN EXTRACT(DOW FROM dr.attendance_date) = 6 
//   THEN 5 * 3600   -- Saturday

//   WHEN EXTRACT(DOW FROM dr.attendance_date) = 0 
//   THEN 0          -- Sunday (optional)

//   ELSE 9 * 3600   -- Normal days
// END AS required_seconds,

//   -- Day Type
//   CASE 
//     WHEN EXTRACT(DOW FROM dr.attendance_date) = ANY(ed.working_days)
//     THEN 'Working Day'
//     ELSE 'Week Off'
//   END AS day_type,

//   -- FINAL STATUS
//   CASE

//     -- Week Off
//     WHEN EXTRACT(DOW FROM dr.attendance_date) != ANY(ed.working_days)
//          AND ls.punch_in IS NULL
//     THEN 'Week Off'

//     -- Week Off Worked
//     WHEN EXTRACT(DOW FROM dr.attendance_date) != ANY(ed.working_days)
//          AND ls.punch_in IS NOT NULL
//     THEN 'Week Off Worked'

//     -- Absent
//     WHEN ls.punch_in IS NULL
//     THEN 'Absent'

//     -- Working (today)
//     WHEN ls.punch_in IS NOT NULL
//          AND ls.punch_out IS NULL
//          AND dr.attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
//     THEN 'Working'

//     -- Late (shift-based)
//     WHEN ls.punch_in::time > ed.start_time + INTERVAL '15 minutes'
//     THEN 'Late Come'

//     -- Early Go (IMPORTANT FIX for night shift)
//     WHEN ls.punch_out IS NOT NULL AND (
//       CASE 
//         WHEN ed.is_night_shift = true
//         THEN ls.punch_out::time < ed.end_time
//         ELSE ls.punch_out::time < ed.end_time
//       END
//     )
//     THEN 'Early Go'

//     -- Present
//     WHEN EXTRACT(EPOCH FROM (ls.punch_out - ls.punch_in)) >= (7 * 3600)
//     THEN 'Present'

//     ELSE 'Absent'

//   END AS status

// FROM date_range dr
// CROSS JOIN emp_data ed

// LEFT JOIN logs_summary ls
//   ON ls.emp_id = ed.emp_id
//  AND ls.attendance_date = dr.attendance_date

// ORDER BY dr.attendance_date DESC;
// `, [empId]);

    const attendance = rows.map(r => {
      let total_hours = null;

      if (r.total_seconds && r.punch_in && r.punch_out) {
        const secs = Math.abs(Number(r.total_seconds));
        total_hours = {
          hours: Math.floor(secs / 3600),
          minutes: Math.floor((secs % 3600) / 60)
        };
      }

      return { ...r, total_hours };
    });

    res.status(200).json({
      success: true,
      count: attendance.length,
      attendance
    });

    // res.status(200).json({
    //   success:true,
    //   count:attendance.length,
    //   attendance
    // })
  } catch (err) {
    console.error("getMyAttendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



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



exports.getActivityLog = async (req, res) => {
  try {
    // 1. Added 'search' to destructuring
    const { from, to, emp_id, search, page = 1, limit = 20 } = req.query;

    const isExport = Number(limit) === -1;
    const parsedLimit = Number(limit) || 20;
    const parsedPage = Number(page) || 1;
    const offset = (parsedPage - 1) * parsedLimit;

    const conditions = [];
    const values = [];

    /* ---------------- Date Filter ---------------- */
    if (from && to) {
      values.push(from, to);
      conditions.push(`(punch_time)::date BETWEEN $${values.length - 1} AND $${values.length}`);
    }

    /* ---------------- Employee Filter ---------------- */
    if (emp_id) {
      values.push(emp_id);
      conditions.push(`emp_id = $${values.length}`);
    }

    /* ---------------- Time/General Search Filter ---------------- */
    if (search) {
      values.push(`%${search.trim()}%`);
      const searchIdx = values.length;
      
      // This allows searching by Emp ID, IP, or specifically the formatted Time
      conditions.push(`(
        emp_id::text ILIKE $${searchIdx} OR 
        device_ip::text ILIKE $${searchIdx} OR 
        TO_CHAR(punch_time, 'HH12:MI AM') ILIKE $${searchIdx} OR
        TO_CHAR(punch_time, 'HH24:MI:SS') ILIKE $${searchIdx}
      )`);
    }

    const whereClause = conditions.length
      ? ` WHERE ${conditions.join(" AND ")}`
      : "";

    /* ---------------- Data Query ---------------- */
    let dataQuery = `
      SELECT 
        emp_id,
        device_ip,
        device_sn,
        TO_CHAR(punch_time, 'YYYY-MM-DD HH24:MI:SS') AS punch_time,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS received_time
      FROM activity_log
      ${whereClause}
      ORDER BY activity_log.punch_time DESC
    `;

    /* ---------------- Count Query ---------------- */
    let countQuery = `
      SELECT COUNT(*)
      FROM activity_log
      ${whereClause}
    `;

    // Important: Create a copy for data query to handle pagination values separately
    let finalValues = [...values];

    /* ---------------- Pagination ---------------- */
    if (!isExport) {
      finalValues.push(parsedLimit, offset);
      dataQuery += ` LIMIT $${finalValues.length - 1} OFFSET $${finalValues.length}`;
    }

    const [data, count] = await Promise.all([
      db.query(dataQuery, finalValues),
      db.query(countQuery, values), // Count query uses original values without limit/offset
    ]);

    res.json({
      success: true,
      pagination: isExport ? null : {
        totalRecords: Number(count.rows[0].count),
        currentPage: parsedPage,
        totalPages: Math.ceil(count.rows[0].count / parsedLimit),
        limit: parsedLimit,
      },
      data: data.rows,
    });

  } catch (err) {
    console.error("Activity Log Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
/**
 * 
 *  TO_CHAR(
      received_time AT TIME ZONE 'UTC' 
      AT TIME ZONE 'Asia/Kolkata',
      'YYYY-MM-DD HH24:MI:SS'
    ) AS received_time
 */
// GET /api/activity-log/export
exports.exportActivityLog = async (req, res) => {
  try {
    const { from, to, emp_id } = req.query;

    let queryText = `SELECT * FROM activity_log`;
    const filters = [];
    const params = [];

    // Same filter logic as above
    if (from && to) {
      params.push(from, to);
      filters.push(`punch_time::DATE BETWEEN $${params.length - 1} AND $${params.length}`);
    }
    if (emp_id) {
      params.push(emp_id);
      filters.push(`emp_id = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
    const finalQuery = `${queryText} ${whereClause} ORDER BY punch_time DESC`;

    const { rows } = await db.query(finalQuery, params);

    res.status(200).json({
      success: true,
      data: rows // Returns the full array
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Export Data Error" });
  }
};

























