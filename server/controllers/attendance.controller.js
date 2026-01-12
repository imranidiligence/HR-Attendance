const {db} = require("../db/connectDB");
const { getDeviceAttendance } = require("../services/zk.service");

/* Sync machine logs */
exports.syncAttendance = async (req, res) => {
  await getDeviceAttendance();
  res.json({ message: "Machine logs synced" });
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


exports.getTodayOrganizationAttendance = async (req, res) => {
  try {
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

          -- First punch AFTER 10:30 AM
          MIN(al.punch_time AT TIME ZONE 'Asia/Kolkata')
            FILTER (
              WHERE (al.punch_time AT TIME ZONE 'Asia/Kolkata') >= p.punch_in_start
            ) AS punch_in,

          -- First punch AT or AFTER 7:00 PM
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

        CASE
          WHEN pc.punch_in IS NOT NULL AND pc.punch_out IS NOT NULL
          THEN pc.punch_out - pc.punch_in
          ELSE INTERVAL '0 minutes'
        END,

        INTERVAL '9 hours',

        CASE
          WHEN pc.punch_in IS NULL THEN 'Absent'
          WHEN pc.punch_out IS NULL THEN 'Working'
          ELSE 'Present'
        END

      FROM punch_calc pc

      ON CONFLICT (emp_id, attendance_date)
      DO UPDATE SET
        punch_in    = EXCLUDED.punch_in,
        punch_out   = EXCLUDED.punch_out,
        total_hours = EXCLUDED.total_hours,
        status      = EXCLUDED.status;
    `);

    /* -------- FETCH TODAY (IST) -------- */
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
        COALESCE(a.total_hours, INTERVAL '0 minutes') AS total_hours,
        COALESCE(a.expected_hours, INTERVAL '9 hours') AS expected_hours,

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

exports.getMyTodayAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;

    /* ---------------- TODAY ---------------- */
    const todayResult = await db.query(
      `
      SELECT punch_in, punch_out, total_hours, status
      FROM daily_attendance
      WHERE emp_id = $1
        AND attendance_date =
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
      LIMIT 1
      `,
      [empId]
    );

    const today = todayResult.rows[0];

    let todayHours = "00:00";

    if (today?.status === "Present" && today.total_hours) {
      const secs =
        today.total_hours.hours * 3600 +
        today.total_hours.minutes * 60;

      const hrs = Math.floor(secs / 3600);
      const mins = Math.floor((secs % 3600) / 60);

      todayHours = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
        2,
        "0"
      )}`;
    }

    if (today?.status === "Working" && today.punch_in) {
      const now = new Date();
      const punchIn = new Date(today.punch_in);

      const diffSecs = Math.max(
        0,
        Math.floor((now - punchIn) / 1000)
      );

      const hrs = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);

      todayHours = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
        2,
        "0"
      )}`;
    }

    /* ---------------- WEEKLY ---------------- */
    const weeklyResult = await db.query(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN status = 'Present' THEN
                EXTRACT(EPOCH FROM total_hours)
              WHEN status = 'Working' THEN
                EXTRACT(
                  EPOCH FROM
                  ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata') - punch_in)
                )
              ELSE 0
            END
          ),
          0
        ) AS total_seconds
      FROM daily_attendance
      WHERE emp_id = $1
        AND attendance_date >=
          DATE_TRUNC(
            'week',
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
          )::DATE
      `,
      [empId]
    );

    const weeklySeconds = Number(weeklyResult.rows[0].total_seconds);
    const weeklyHrs = Math.floor(weeklySeconds / 3600);
    const weeklyMins = Math.floor((weeklySeconds % 3600) / 60);

    /* ---------------- RESPONSE ---------------- */
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



// /*  Employee – All  attendance */ 
exports.getMyAttendance = async (req, res) => {
  try {
    const empId = req.user.emp_id;

    const { rows } = await db.query(
      `
      WITH dates AS (
        -- All dates from start of last month to today
        SELECT generate_series(
          date_trunc('month', current_date - interval '1 month')::date,
          current_date,
          interval '1 day'
        )::date AS attendance_date
      ),

      logs AS (
        -- First and last punches from attendance_logs per day
        SELECT
          emp_id,
          (punch_time AT TIME ZONE 'Asia/Kolkata')::date AS attendance_date,
          MIN(punch_time) AS first_punch,
          MAX(punch_time) AS last_punch
        FROM attendance_logs
        WHERE emp_id = $1
        GROUP BY emp_id, (punch_time AT TIME ZONE 'Asia/Kolkata')::date
      )

      SELECT
        $1 AS emp_id,
        u.name AS employee_name,
        d.attendance_date,

        -- Punch in: daily_attendance first, else logs first punch, else 10:30
        CASE
          WHEN da.punch_in IS NOT NULL AND da.punch_in::time >= '10:30:00' THEN da.punch_in
          WHEN l.first_punch IS NOT NULL AND (l.first_punch AT TIME ZONE 'Asia/Kolkata')::time >= '10:30:00'
            THEN l.first_punch
          ELSE (d.attendance_date::text || ' 10:30:00')::timestamptz
        END AS punch_in,

        -- Punch out: daily_attendance punch_out, else logs last punch
        COALESCE(da.punch_out, l.last_punch) AS punch_out,

        -- total_seconds: difference between punch_in and punch_out
        CASE
          WHEN
            (CASE
              WHEN da.punch_in IS NOT NULL AND da.punch_in::time >= '10:30:00' THEN da.punch_in
              WHEN l.first_punch IS NOT NULL AND (l.first_punch AT TIME ZONE 'Asia/Kolkata')::time >= '10:30:00'
                THEN l.first_punch
              ELSE (d.attendance_date::text || ' 10:30:00')::timestamptz
            END) IS NOT NULL
            AND COALESCE(da.punch_out, l.last_punch) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (COALESCE(da.punch_out, l.last_punch) -
                                    (CASE
                                      WHEN da.punch_in IS NOT NULL AND da.punch_in::time >= '10:30:00' THEN da.punch_in
                                      WHEN l.first_punch IS NOT NULL AND (l.first_punch AT TIME ZONE 'Asia/Kolkata')::time >= '10:30:00'
                                        THEN l.first_punch
                                      ELSE (d.attendance_date::text || ' 10:30:00')::timestamptz
                                    END)))
          ELSE NULL
        END AS total_seconds,

        da.expected_hours,
        COALESCE(da.status,
                 CASE
                   WHEN l.first_punch IS NULL THEN 'Absent'
                   ELSE 'Working'
                 END) AS status

      FROM dates d
      LEFT JOIN daily_attendance da
        ON da.emp_id = $1
       AND (da.attendance_date AT TIME ZONE 'Asia/Kolkata')::date = d.attendance_date
      LEFT JOIN logs l
        ON l.emp_id = $1
       AND l.attendance_date = d.attendance_date
      JOIN users u ON u.emp_id = $1
      ORDER BY d.attendance_date DESC;
      `,
      [empId]
    );

    // Convert seconds → { hours, minutes } for frontend
    const formatted = rows.map(r => {
      let total_hours = {};
      if (r.total_seconds != null) {
        const secs = Number(r.total_seconds);
        total_hours = {
          hours: Math.floor(secs / 3600),
          minutes: Math.floor((secs % 3600) / 60)
        };
      }

      return {
        ...r,
        total_hours
      };
    });

    res.status(200).json(formatted);
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




























