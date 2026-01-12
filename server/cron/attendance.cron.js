const cron = require("node-cron");
const { getDeviceAttendance } = require("../services/zk.service");
const {
  generateDailyAttendance,
  syncAttendance,
} = require("../controllers/attendance.controller");

/* 
   1️ DEVICE ATTENDANCE SYNC
   Runs every 5 minutes (SAFE & EFFICIENT)*/
cron.schedule(
  "*/5 * * * *",
  async () => {
    try {
      console.log("[CRON] Device attendance sync started");
      await getDeviceAttendance();
      // await syncAttendance();
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
      // await syncAttendance();
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
      console.log(" [CRON] Safety sync completed");
    } catch (err) {
      console.error(" [CRON] Safety sync error:", err.message);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

console.log(" Attendance cron jobs initialized");
