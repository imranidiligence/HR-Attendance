const { db } = require("../db/connectDB");
require("dotenv").config();
const { getDeviceAttendance } = require("../services/zk.service");
const sendEmail = require("../utils/mailer");
const cron = require("node-cron");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");
const env = process.env.NODE_ENV;

// Pick the correct file
const envFile = env === "production" ? ".env.production" : ".env.local";

// console.log("envFile Attendance", envFile);
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Determine admin emails dynamically
const adminEmails =
  process.env.NODE_ENV === "production"
    ? process.env.PROD_ADMIN_EMAILS // from .env.production
    : process.env.LOCAL_ADMIN_EMAILS; // from .env.local

const ccEmails =
  process.env.NODE_ENV === "production"
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
    await db.query(
      `
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
    `,
      [empId],
    );

    // 2. Fetch attendance with Working Hours Calculation
    const { rows } = await db.query(
      `
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
    `,
      [empId],
    );
    console.log(rows);
    // 3. Format result for Frontend (consistent with your table row logic)
    const formattedData = rows.map((r) => {
      const formatTime = (isoStr) => {
        if (!isoStr) return "---";
        return new Date(isoStr).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });
      };

      // Handle PostgreSQL interval object correctly
      const hours = r.total_hours?.hours || 0;
      const minutes = r.total_hours?.minutes || 0;

      return {
        ...r,
        punch_in: formatTime(r.punch_in),
        punch_out: formatTime(r.punch_out),
        total_hours_str: `${hours}h ${minutes}m`,
      };
    });

    res.status(200).json({
      total_documents: formattedData.length,
      attendance: formattedData,
    });
  } catch (err) {
    console.error("❌ getAdminMyAttendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addEmployController = async (req, res) => {
  const client = await db.connect();

  console.log("addEmp", req.body);

  try {
    const {
      name,
      email,
      password,
      is_active,
      roles,
    } = req.body;

    console.log(name, email, password, is_active, roles);
    console.log("Roles:", roles);

    // 1. Validation
    if (!name || !email || !password || !is_active || !roles) {
      return res.status(400).json({
        message: "All essential fields required",
      });
    }

    // Validate roles
    if (roles !== undefined && !Array.isArray(roles)) {
      return res.status(400).json({
        message: "Roles must be an array",
      });
    }

    // 2. Start Transaction
    await client.query("BEGIN");

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(String(password), 10);

    const profile_image = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    // 4. Insert into users table
    const userResult = await client.query(
      `
      INSERT INTO users 
        (name, email, password, is_active, profile_image)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        name,
        email.toLowerCase().trim(),
        hashedPassword,
        is_active === undefined ? true : is_active,
        profile_image,
      ]
    );

    const newUserId = userResult.rows[0].id;

    // 5. Insert roles into user_roles table
    if (roles && roles.length > 0) {
      for (const roleId of roles) {
        await client.query(
          `
          INSERT INTO user_role (user_id, role_id)
          VALUES ($1, $2)
          `,
          [newUserId, roleId]
        );
      }
    }

    // 6. Commit Transaction
    await client.query("COMMIT");

    res.status(201).json({
      message: "Employee created successfully",
      user: {
        id: newUserId,
        name,
        email,
        roles: roles || [],
      },
    });

  } catch (error) {
    // Rollback transaction
    await client.query("ROLLBACK");

    console.error("Transaction Error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        message: "Email or Employee ID already exists",
      });
    }

    res.status(500).json({
      message: "Internal Server Error",
    });

  } finally {
    client.release();
  }
};

exports.updateEmployController = async (req, res) => {
  const client = await db.connect();

  try {
    const { id } = req.params;

    const {
      name,
      email,
      password,
      is_active,
      emp_id,
      roles,
    } = req.body;

    console.log("Update Employee:", id, req.body);

    // Validate roles only if it was provided
    if (roles !== undefined && !Array.isArray(roles)) {
      return res.status(400).json({
        message: "Roles must be an array",
      });
    }

    // Validate roles are not empty if roles is provided
    if (roles !== undefined && roles.length === 0) {
      return res.status(400).json({
        message: "At least one role is required",
      });
    }

    await client.query("BEGIN");

    // ------------------------------------------------
    // 1. Check if user exists
    // ------------------------------------------------

    const userResult = await client.query(
      `SELECT id, name, email, emp_id, is_active
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Employee not found",
      });
    }

    // ------------------------------------------------
    // 2. Build dynamic UPDATE query
    // ------------------------------------------------

    const updateFields = [];
    const updateValues = [];
    let parameterIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${parameterIndex}`);
      updateValues.push(name);
      parameterIndex++;
    }

    if (email !== undefined) {
      updateFields.push(`email = $${parameterIndex}`);
      updateValues.push(email.toLowerCase().trim());
      parameterIndex++;
    }
    if (emp_id !== undefined) {
      updateFields.push(`emp_id = $${parameterIndex}`);
      updateValues.push(emp_id);
      parameterIndex++;
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${parameterIndex}`);
      updateValues.push(is_active);
      parameterIndex++;
    }

    // ------------------------------------------------
    // 3. Password
    // ------------------------------------------------

    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(
        String(password),
        10
      );

      updateFields.push(`password = $${parameterIndex}`);
      updateValues.push(hashedPassword);
      parameterIndex++;
    }

    // ------------------------------------------------
    // 4. Update users table only if fields exist
    // ------------------------------------------------

    let updatedUser;

    if (updateFields.length > 0) {
      updateValues.push(id);

      const updateQuery = `
        UPDATE users
        SET ${updateFields.join(", ")}
        WHERE id = $${parameterIndex}
        RETURNING id, name, email, is_active
      `;

      const result = await client.query(
        updateQuery,
        updateValues
      );

      updatedUser = result.rows[0];
    } else {
      updatedUser = userResult.rows[0];
    }

    // ------------------------------------------------
    // 5. Update roles ONLY if roles was passed
    // ------------------------------------------------

    if (roles !== undefined) {

      // Delete existing roles
      await client.query(
        `
        DELETE FROM user_role
        WHERE user_id = $1
        `,
        [id]
      );

      // Insert new roles
      for (const roleId of roles) {
        await client.query(
          `
          INSERT INTO user_role (user_id, role_id)
          VALUES ($1, $2)
          `,
          [id, roleId]
        );
      }
    }

    // ------------------------------------------------
    // 6. Get current roles
    // ------------------------------------------------

    const roleResult = await client.query(
      `
      SELECT r.role_id, r.role_name
      FROM user_role ur
      INNER JOIN roles r
        ON r.role_id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.role_id
      `,
      [id]
    );

    // ------------------------------------------------
    // 7. Commit
    // ------------------------------------------------

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Employee updated successfully",

      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        is_active: updatedUser.is_active,
        emp_id: updatedUser.emp_id,

        roles: roleResult.rows,
      },
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error("Update Employee Error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      message: "Internal Server Error",
    });

  } finally {
    client.release();
  }
};

/*  Generate daily attendance */
exports.getTodayAttendance = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Total employees
    const countResult = await db.query(`
      SELECT COUNT(*) AS total
      FROM users
      WHERE role IN ('employee', 'admin')
      AND is_active = true;
    `);

    const totalItems = Number(countResult.rows[0].total);

    // Attendance data
    const result = await db.query(
      `
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
          COALESCE(d.total_hours,0) AS total_hours

      FROM users u

      LEFT JOIN daily_attendance d
        ON u.id = d.user_id
       AND d.attendance_date = CURRENT_DATE

      WHERE u.role = 'employee'
        AND u.is_active = true

      ORDER BY u.name

      LIMIT $1
      OFFSET $2;
      `,
      [limit, offset],
    );

    res.json({
      employees: result.rows,
      pagination: {
        currentPage: page,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        limit,
      },
    });
  } catch (err) {
    console.error("getTodayAttendance error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
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
    console.log(
      `[${new Date().toISOString()}] CRON: Triggering processAndSendAttendanceReport...`,
    );

    // Pass 'true' so the email actually sends during the cron run
    const data = await exports.processAndSendAttendanceReport(true);

    console.log(
      `[${new Date().toISOString()}] CRON: Success. Processed ${data.length} records.`,
    );
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

exports.processAndSendAttendanceReport = async (
  sendEmailToAdmin = false,
  req = null,
  res = null,
) => {
  try {
    const todayIST = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

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
    console.log("Attendance Rows Fetched:", rows);

    const mailDateFormat = new Date()
      .toLocaleDateString("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "-");

    dotenv.config({
      path:
        process.env.NODE_ENV === "production"
          ? ".env.production"
          : ".env.local",
    });
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
      const type =
        process.env.NODE_ENV === "production" ? "production" : "local";

      const emailResult = await db.query(
        `SELECT email FROM "EmployeeEmail" WHERE type = $1`,
        [type],
      );

      // console.log(first)
      const row = emailResult.rows;

      // console.log("AdminEmail Row", row);

      const adminEmails = emailResult.rows
        .map((r) => r.email?.trim())
        .filter(Boolean)
        .join(",");

      // console.log("process.env.NODE_ENV",process.env.NODE_ENV)

      console.log("adminEmails", adminEmails);

      // Generate HTML rows for the email

      // console.log("rows",rows)
      const tableRowsHtml = rows
        .filter((emp) => emp.is_active && emp.emp_id && emp.emp_id !== "2020")
        .map((emp) => {
          // console.log("emp",emp)
          // 1. Status Colors (Backgrounds)
          const statusBg =
            emp.status === "Working"
              ? "#ff9800"
              : emp.status === "Absent"
                ? "#dc3545"
                : "#28a745";

          // 2. Format Times & Date
          const timeIn = emp.punch_in
            ? new Date(emp.punch_in).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : "---";

          const timeOut = emp.punch_out
            ? new Date(emp.punch_out).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : "---";

          // const attendanceDate = emp.punch_in
          //   ? new Date(emp.punch_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' })
          //   : '---';

          const attendanceDate = emp.punch_in
            ? new Date(emp.punch_in)
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
                .replace(/\//g, "-")
            : "---";

          // 3. Return Table Row

          // console.log("emp",emp)
          return `
          <tr>
            <td style="border:1px solid #ddd; padding:8px;">${emp.emp_id}</td>
            <td style="border:1px solid #ddd; padding:8px;">${emp.name}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${attendanceDate}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${timeIn}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${timeOut}</td>
            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${formatInterval(emp.total_hours) || "0h 0m"}</td>
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
        })
        .join("");

      // console.log("rows",rows)
      const now = new Date();
      const formattedDate = now
        .toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
        .replace(/\//g, "-");

      console.log("adminEmail Send Mail", adminEmails);

      // console.log(formattedDate);
      await sendEmail(
        adminEmails,
        subject,
        "admin_all_present",
        {
          date: formattedDate,
          time: new Date().toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
          }),
          employee_rows: tableRowsHtml,
        },
        ccEmails,
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

// In attendance.controller.js - Updated getTodayOrganizationAttendance
exports.getTodayOrganizationAttendance = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 15, 1);
    const offset = (page - 1) * limit;

    const showInactive =
      req.query.showInactive === "true";

    /*
     * =========================================================
     * TODAY IN IST
     * =========================================================
     *
     * Do not use CURRENT_DATE because PostgreSQL session timezone
     * may not be Asia/Kolkata.
     */
    const todayQuery = `
      SELECT (
        CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
      )::DATE AS today
    `;

    const { rows: todayRows } =
      await db.query(todayQuery);

    const today = todayRows[0].today;

    /*
     * =========================================================
     * COUNT EMPLOYEES
     * =========================================================
     *
     * organizations is now the employee master.
     *
     * personal contains employee details.
     */
    let countQuery = `
      SELECT COUNT(DISTINCT o.or_id) AS total
      FROM public.organizations o

      INNER JOIN public.personal p
        ON p.pr_id = o.pr_id

      WHERE o.or_emp_id IS NOT NULL
        AND TRIM(o.or_emp_id) <> ''
    `;

    const countParams = [];

    if (!showInactive) {
      countQuery += `
        AND COALESCE(o.or_is_active, TRUE) = TRUE
      `;
    }

    const countResult =
      await db.query(
        countQuery,
        countParams
      );

    const totalItems = parseInt(
      countResult.rows[0].total,
      10
    );

    /*
     * =========================================================
     * ATTENDANCE QUERY
     * =========================================================
     *
     * organizations
     *      ↓
     * personal
     *      ↓
     * daily_attendance
     *      ↓
     * attendence_status
     *
     * LEFT JOIN daily_attendance because an employee without
     * a punch must still appear as Absent.
     */
    let query = `
      SELECT

        /*
         * =====================================================
         * ATTENDANCE DATE
         * =====================================================
         */
        (
          CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
        )::DATE AS attendance_date,

        /*
         * =====================================================
         * EMPLOYEE DETAILS
         * =====================================================
         */
        TRIM(o.or_emp_id) AS emp_id,

        COALESCE(
          o.or_is_active,
          FALSE
        ) AS is_active,

        COALESCE(
          NULLIF(TRIM(p.pr_name), ''),
          TRIM(
            CONCAT_WS(
              ' ',
              p.pr_first_name,
              p.pr_last_name
            )
          ),
          '-'
        ) AS name,

        /*
         * You do not currently have a role column in the
         * organizations schema provided.
         */
        'employee' AS role,

        /*
         * =====================================================
         * ATTENDANCE
         * =====================================================
         */
        da.punch_in,
        da.punch_out,
        da.status_id,

        COALESCE(
          ast.status_name,
          'Absent'
        ) AS status,

        /*
         * =====================================================
         * TOTAL HOURS
         * =====================================================
         *
         * Convert PostgreSQL INTERVAL into total seconds.
         *
         * Example:
         *
         * 00:09:48 -> 588 seconds
         * 08:30:25 -> 30625 seconds
         *
         * This avoids the pg driver returning the INTERVAL
         * as an object like:
         *
         * {
         *   minutes: 9,
         *   seconds: 48
         * }
         */
        EXTRACT(
          EPOCH FROM COALESCE(
            da.total_hours,
            INTERVAL '0'
          )
        ) AS total_hours_seconds

      FROM public.organizations o

      INNER JOIN public.personal p
        ON p.pr_id = o.pr_id

      /*
       * Daily attendance is LEFT JOINed so employees with
       * no punch are returned as well.
       */
      LEFT JOIN public.daily_attendance da

        ON TRIM(da.emp_id) =
           TRIM(o.or_emp_id)

       AND da.attendance_date = $1

      /*
       * Status master
       */
      LEFT JOIN public.attendence_status ast
        ON ast.id = da.status_id

       AND COALESCE(
         ast.is_active,
         TRUE
       ) = TRUE

      WHERE o.or_emp_id IS NOT NULL
        AND TRIM(o.or_emp_id) <> ''
    `;

    const queryParams = [today];

    /*
     * =========================================================
     * ACTIVE / INACTIVE FILTER
     * =========================================================
     */

    if (!showInactive) {
      query += `
        AND COALESCE(
          o.or_is_active,
          TRUE
        ) = TRUE
      `;
    }

    /*
     * =========================================================
     * ORDER + PAGINATION
     * =========================================================
     */

    query += `
      ORDER BY
        COALESCE(o.or_is_active, FALSE) DESC,

        TRIM(
          COALESCE(
            NULLIF(p.pr_name, ''),
            CONCAT_WS(
              ' ',
              p.pr_first_name,
              p.pr_last_name
            )
          )
        ) ASC

      LIMIT $2
      OFFSET $3
    `;

    queryParams.push(
      limit,
      offset
    );

    const { rows } =
      await db.query(
        query,
        queryParams
      );

    console.log(
      "Attendance Rows Fetched: organization",
      rows
    );

    /*
     * =========================================================
     * FORMAT DATA FOR FRONTEND
     * =========================================================
     */

    const formattedRows =
      rows.map((row) => {

        /*
         * -----------------------------------------------------
         * TOTAL HOURS
         * -----------------------------------------------------
         *
         * total_hours_seconds comes from:
         *
         * EXTRACT(EPOCH FROM da.total_hours)
         *
         * Example:
         *
         * 00:09:48
         *      ↓
         * 588 seconds
         *      ↓
         * 00:09
         *
         * 08:30:25
         *      ↓
         * 30625 seconds
         *      ↓
         * 08:30
         */
        let totalHours = "00:00";

        if (
          row.total_hours_seconds !== null &&
          row.total_hours_seconds !== undefined
        ) {
          const totalSeconds = Math.max(
            0,
            Math.floor(
              Number(row.total_hours_seconds)
            )
          );

          const hours = Math.floor(
            totalSeconds / 3600
          );

          const minutes = Math.floor(
            (totalSeconds % 3600) / 60
          );

          totalHours =
            `${String(hours).padStart(2, "0")}:${String(
              minutes
            ).padStart(2, "0")}`;
        }

        /*
         * -----------------------------------------------------
         * PUNCH IN
         * -----------------------------------------------------
         */
        const punchIn =
          row.punch_in
            ? new Date(
                row.punch_in
              ).toLocaleTimeString(
                "en-IN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone:
                    "Asia/Kolkata",
                }
              )
            : "--";

        /*
         * -----------------------------------------------------
         * PUNCH OUT
         * -----------------------------------------------------
         */
        const punchOut =
          row.punch_out
            ? new Date(
                row.punch_out
              ).toLocaleTimeString(
                "en-IN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone:
                    "Asia/Kolkata",
                }
              )
            : "--";

        /*
         * -----------------------------------------------------
         * RESPONSE
         * -----------------------------------------------------
         */
        return {
          attendance_date:
            `${row.attendance_date}T18:30:00.000Z`,

          emp_id:
            row.emp_id,

          is_active:
            row.is_active,

          name:
            row.name,

          punch_in:
            punchIn,

          punch_out:
            punchOut,

          role:
            row.role,

          status_id:
            row.status_id,

          status:
            row.status,

          total_hours:
            totalHours,
        };
      });

    /*
     * =========================================================
     * RESPONSE
     * =========================================================
     */

    res.status(200).json({
      success: true,

      employees: formattedRows,

      pagination: {
        currentPage: page,

        totalItems,

        totalPages:
          Math.ceil(
            totalItems / limit
          ),

        limit,
      },
    });

  } catch (error) {
    console.error(
      "Organization attendance error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to process attendance",
    });
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
      [empId],
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
        [empId],
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
            row.punch_out !== row.punch_in ? formatTime(row.punch_out) : null,
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
      [empId],
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

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 15, 1);
    const offset = (page - 1) * limit;

    const { startDate, endDate } = req.query;

    // Default: last 30 days + today
    const defaultToDate = `
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    `;

    const defaultFromDate = `
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '30 days'
    `;

    const fromDate = startDate || null;
    const toDate = endDate || null;

    // Validate date range
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be greater than endDate",
      });
    }

    // ---------------------------------------------------------
    // TOTAL ITEMS
    // ---------------------------------------------------------
    const countResult = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM daily_attendance
      WHERE emp_id = $1
        AND attendance_date BETWEEN
            COALESCE($2::date, ${defaultFromDate})
            AND
            COALESCE($3::date, ${defaultToDate});
      `,
      [empId, fromDate, toDate]
    );

    const totalItems = countResult.rows[0].total;

    // ---------------------------------------------------------
    // ATTENDANCE DATA
    // ---------------------------------------------------------
    const { rows } = await db.query(
      `
      SELECT
          da.emp_id,

          TO_CHAR(
            da.attendance_date,
            'YYYY-MM-DD'
          ) AS attendance_date,

          da.punch_in,
          da.punch_out,

          da.total_hours,
          da.expected_hours,

          da.late_arrival,
          da.is_late_arrived,

          da.early_go,
          da.is_early_gone,

          da.status_id

      FROM daily_attendance da

      WHERE da.emp_id = $1
        AND da.attendance_date BETWEEN
            COALESCE($2::date, ${defaultFromDate})
            AND
            COALESCE($3::date, ${defaultToDate})

      ORDER BY da.attendance_date DESC

      LIMIT $4
      OFFSET $5;
      `,
      [
        empId,
        fromDate,
        toDate,
        limit,
        offset,
      ]
    );

    console.log(
      "Attendance Rows Fetched getMyAttendance:",
      rows
    );

    // ---------------------------------------------------------
    // FORMAT TOTAL HOURS
    // ---------------------------------------------------------
    const attendance = rows.map((row) => {
      let total_hours = null;

      if (
        row.total_hours !== null &&
        row.total_hours !== undefined
      ) {
        total_hours = row.total_hours;
      } else if (
        row.punch_in &&
        row.punch_out
      ) {
        const punchIn = new Date(row.punch_in);
        const punchOut = new Date(row.punch_out);

        const seconds =
          (punchOut.getTime() - punchIn.getTime()) / 1000;

        if (seconds > 0) {
          total_hours = {
            hours: Math.floor(seconds / 3600),
            minutes: Math.floor(
              (seconds % 3600) / 60
            ),
          };
        }
      }

      return {
        ...row,
        total_hours,
      };
    });

    return res.status(200).json({
      success: true,
      attendance,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        limit,
        hasNext:
          page < Math.ceil(totalItems / limit),
        hasPrevious: page > 1,
      },
    });

  } catch (err) {
    console.error(
      "getMyAttendance error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getMyHolidays = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        h.*,
        htm.holiday_type_name
      FROM holidays h
      LEFT JOIN holiday_type_master htm
        ON h.holiday_type_id = htm.holiday_type_id
      ORDER BY h.holiday_date ASC
    `);

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
      conditions.push(
        `(punch_time)::date BETWEEN $${values.length - 1} AND $${values.length}`,
      );
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
      pagination: isExport
        ? null
        : {
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

// New controller
// New controller for all users including inactive
exports.getTodayOrganizationAttendanceAll = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 15, 1);
    const offset = (page - 1) * limit;

    const countResult = await db.query(`
      SELECT COUNT(DISTINCT p.pr_id)::int AS total
      FROM public.personal p
      INNER JOIN public.user_role_relation urr
        ON urr.pr_id = p.pr_id
      INNER JOIN public.usr_role_master rm
        ON rm.rm_role_id = urr.rl_role_id
      WHERE LOWER(rm.rm_role_name) IN ('employee', 'admin')
        AND p.pr_is_active = true
    `);

    const totalItems = countResult.rows[0]?.total || 0;

    const query = `
      WITH attendance_summary AS (
        SELECT
          da.emp_id,
          da.attendance_date,

          COUNT(*) AS punch_count,

          MIN(da.punch_in) AS first_punch,

          MAX(
            CASE
              WHEN da.punch_out = da.punch_in THEN NULL
              ELSE da.punch_out
            END
          ) AS last_punch,

          COALESCE(
            SUM(
              CASE
                WHEN da.punch_out IS NOT NULL
                THEN da.punch_out - da.punch_in
                ELSE INTERVAL '0'
              END
            ),
            INTERVAL '0'
          ) AS total_hours

        FROM public.daily_attendance da

        WHERE da.attendance_date = CURRENT_DATE

        GROUP BY
          da.emp_id,
          da.attendance_date
      )

      SELECT
        p.pr_id,

        o.or_emp_id AS emp_id,

        TRIM(
          COALESCE(p.pr_first_name, '') ||
          CASE
            WHEN p.pr_last_name IS NOT NULL
                 AND p.pr_last_name <> ''
            THEN ' ' || p.pr_last_name
            ELSE ''
          END
        ) AS name,

        p.pr_email AS email,

        COALESCE(
          (
            SELECT STRING_AGG(
              DISTINCT rm2.rm_role_name,
              ', '
              ORDER BY rm2.rm_role_name
            )
            FROM public.user_role_relation urr2
            INNER JOIN public.usr_role_master rm2
              ON rm2.rm_role_id = urr2.rl_role_id
            WHERE urr2.pr_id = p.pr_id
          ),
          ''
        ) AS role,

        p.pr_is_active AS is_active,

        o.or_is_active AS organization_is_active,

        o.or_organization_email AS organization_email,

        o.or_organization_name AS organization_name,

        o.or_organization_location AS organization_location,

        o.or_department_id AS department_id,

        o.or_designation_id AS designation_id,

        o.or_employee_type_id AS employee_type_id,

        o.or_reporting_location_id AS reporting_location_id,

        o.or_reporting_to_id AS reporting_to_id,

        o.or_joining_date AS joining_date,

        o.or_leaving_date AS leaving_date,

        COALESCE(
          a.attendance_date,
          CURRENT_DATE
        ) AS attendance_date,

        a.first_punch AS punch_in,

        a.last_punch AS punch_out,

        CASE
          WHEN p.pr_is_active = false
            THEN 'Inactive'

          WHEN o.or_is_active = false
            THEN 'Inactive'

          WHEN a.punch_count IS NULL
            THEN 'Absent'

          WHEN a.punch_count >= 1
               AND a.last_punch IS NULL
            THEN 'Working'

          WHEN a.punch_count >= 1
            THEN 'Present'

          ELSE 'Absent'
        END AS status,

        COALESCE(
          a.total_hours,
          INTERVAL '0'
        ) AS total_hours

      FROM public.personal p

      INNER JOIN public.user_role_relation urr
        ON urr.pr_id = p.pr_id

      INNER JOIN public.usr_role_master rm
        ON rm.rm_role_id = urr.rl_role_id

      LEFT JOIN public.organizations o
        ON o.pr_id = p.pr_id

      LEFT JOIN attendance_summary a
        ON a.emp_id = o.or_emp_id

      WHERE LOWER(rm.rm_role_name) IN ('employee', 'admin')
        AND p.pr_is_active = true

      GROUP BY
        p.pr_id,
        p.pr_first_name,
        p.pr_last_name,
        p.pr_email,
        p.pr_is_active,

        o.or_emp_id,
        o.or_is_active,
        o.or_organization_email,
        o.or_organization_name,
        o.or_organization_location,
        o.or_department_id,
        o.or_designation_id,
        o.or_employee_type_id,
        o.or_reporting_location_id,
        o.or_reporting_to_id,
        o.or_joining_date,
        o.or_leaving_date,

        a.attendance_date,
        a.first_punch,
        a.last_punch,
        a.punch_count,
        a.total_hours

      ORDER BY
        CASE
          WHEN o.or_is_active = true THEN 0
          ELSE 1
        END,

        CASE
          WHEN p.pr_is_active = true THEN 0
          ELSE 1
        END,

        name ASC

      LIMIT $1
      OFFSET $2
    `;

    const { rows } = await db.query(
      query,
      [limit, offset]
    );

    console.log(
      "Attendance Rows Fetched: organization (all users)",
      rows
    );

    const formattedRows = rows.map((row) => {
      let totalHours = "00:00";

      if (row.total_hours) {
        const interval = String(row.total_hours);

        const match = interval.match(
          /(?:(\d+)\s+days?\s+)?(\d{1,3}):(\d{2}):(\d{2}(?:\.\d+)?)/ 
        );

        if (match) {
          const days = parseInt(match[1] || 0, 10);
          const hours = parseInt(match[2] || 0, 10);
          const minutes = parseInt(match[3] || 0, 10);

          const totalMinutes =
            days * 24 * 60 +
            hours * 60 +
            minutes;

          const finalHours = Math.floor(
            totalMinutes / 60
          );

          const finalMinutes =
            totalMinutes % 60;

          totalHours =
            `${String(finalHours).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`;
        }
      }

      return {
        ...row,

        total_hours: totalHours,

        punch_in: row.punch_in
          ? new Date(row.punch_in).toLocaleTimeString(
              "en-IN",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
              }
            )
          : "--",

        punch_out: row.punch_out
          ? new Date(row.punch_out).toLocaleTimeString(
              "en-IN",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
              }
            )
          : "--",
      };
    });

    return res.status(200).json({
      success: true,

      employees: formattedRows,

      pagination: {
        currentPage: page,
        totalItems: totalItems,
        totalPages: Math.ceil(
          totalItems / limit
        ),
        limit: limit,
      },
    });

  } catch (error) {
    console.error(
      "Manual report error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to process attendance",
      error: error.message,
    });
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
      filters.push(
        `punch_time::DATE BETWEEN $${params.length - 1} AND $${params.length}`,
      );
    }
    if (emp_id) {
      params.push(emp_id);
      filters.push(`emp_id = $${params.length}`);
    }

    const whereClause =
      filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
    const finalQuery = `${queryText} ${whereClause} ORDER BY punch_time DESC`;

    const { rows } = await db.query(finalQuery, params);

    res.status(200).json({
      success: true,
      data: rows, // Returns the full array
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Export Data Error" });
  }
};
