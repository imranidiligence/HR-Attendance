const cron = require("node-cron");
const { getDeviceAttendance } = require("../services/zk.service");
const {
  generateDailyAttendance,
  syncAttendance,
} = require("../controllers/attendance.controller");
const { db } = require("../db/connectDB");

/* 
   1️ DEVICE ATTENDANCE SYNC
   Runs every 5 minutes (SAFE & EFFICIENT)*/
cron.schedule(
  "*/5 * * * *",
  async () => {
    try {
      console.log("[CRON] Device attendance sync started");
      await getDeviceAttendance();
      await aggregateTodayAttendance(); // ✅ ADDED (fresh daily snapshot)
      console.log(" [CRON] Device attendance sync completed");
    } catch (err) {
      console.error(" [CRON] Device sync error:", err.message);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

/* 
    DAILY ATTENDANCE GENERATION
   Runs at 12:05 AM IST
 */
cron.schedule(
  "5 0 * * *",
  async () => {
    try {
      console.log(" [CRON] Daily attendance generation started");
      await generateDailyAttendance();
      console.log(" [CRON] Daily attendance generated");
    } catch (err) {
      console.error(" [CRON] Daily attendance error:", err.message);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

/* 
    SAFETY SYNC (MISSED PUNCH RECOVERY)
   Runs at 6:30 AM IST*/
cron.schedule(
  "30 6 * * *",
  async () => {
    try {
      console.log(" [CRON] Safety sync started");
      await syncAttendance();
      await aggregateTodayAttendance(); // ✅ SAFETY REBUILD
      console.log(" [CRON] Safety sync completed");
    } catch (err) {
      console.error(" [CRON] Safety sync error:", err.message);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);


// Today Update 
async function aggregateTodayAttendance() {
  const today = new Date()
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD

  await db.query(
    `
    INSERT INTO daily_attendance (
      emp_id,
      attendance_date,
      punch_in,
      punch_out,
      total_hours,
      status
    )
    SELECT
      emp_id,
      work_date,
      MIN(punch_time) AS punch_in,
      CASE
        WHEN MIN(punch_time) = MAX(punch_time) THEN NULL
        ELSE MAX(punch_time)
      END AS punch_out,
      CASE
        WHEN MIN(punch_time) = MAX(punch_time) THEN INTERVAL '0'
        ELSE MAX(punch_time) - MIN(punch_time)
      END AS total_hours,
      CASE
        WHEN COUNT(*) = 0 THEN 'Absent'
        WHEN MIN(punch_time) = MAX(punch_time) THEN 'Working'
        ELSE 'Present'
      END AS status
    FROM (
      SELECT
        emp_id,
        punch_time AT TIME ZONE 'Asia/Kolkata' AS punch_time,
        (punch_time AT TIME ZONE 'Asia/Kolkata')::DATE AS work_date
      FROM activity_log
      WHERE (punch_time AT TIME ZONE 'Asia/Kolkata')::DATE = $1
    ) t
    GROUP BY emp_id, work_date
    ON CONFLICT (emp_id, attendance_date)
    DO UPDATE SET
      punch_in = EXCLUDED.punch_in,
      punch_out = EXCLUDED.punch_out,
      total_hours = EXCLUDED.total_hours,
      status = EXCLUDED.status
    `,
    [today]
  );
}

console.log(" Attendance cron jobs initialized");
