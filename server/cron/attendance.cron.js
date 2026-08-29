// // const cron = require("node-cron");
// // const { getDeviceAttendance } = require("../services/zk.service");
// // const {
// //   generateDailyAttendance,
// //   syncAttendance,
// //   processAndSendAttendanceReport,
// // } = require("../controllers/attendance.controller");
// // const { db } = require("../db/connectDB");
// const cron = require("node-cron");
// const { db } = require("../db/connectDB");
// const { getDeviceAttendance } = require("../services/zk.service");
// const {syncMachineToActivityLog} = require("../services/activity.log.service");
// const { syncActivityToAttendanceLogs } = require('../services/attendance.log.service')
// const { generateDailyAttendance } = require('../services/daily.attendance.service')
// // /* 
// //    1️ DEVICE ATTENDANCE SYNC
// //    Runs every 5 minutes (SAFE & EFFICIENT)*/
// // cron.schedule(
// //   "*/1 * * * *",
// //   async () => {
// //     try {
// //       console.log("[CRON] Device attendance sync started");
// //       await getDeviceAttendance();
// //       // await aggregateTodayAttendance(); 
// //       console.log(" [CRON] Device attendance sync completed");
// //     } catch (err) {
// //       console.error(" [CRON] Device sync error:", err);
// //     }
// //   },
// //   {
// //     timezone: "Asia/Kolkata",
// //   }
// // );

// const TIMEZONE = "Asia/Kolkata";

// async function runWithLock(jobName, jobFunction) {
//   const client = await db.connect();

//   let locked = false;

//   try {
//     const lockResult = await client.query(
//       `
//       SELECT pg_try_advisory_lock(hashtext($1)) AS locked
//       `,
//       [jobName]
//     );

//     locked = lockResult.rows[0]?.locked === true;

//     if (!locked) {
//       console.log(
//         `[CRON] ${jobName} skipped - previous execution is still running`
//       );

//       return;
//     }

//     await jobFunction(client);
//   } catch (error) {
//     console.error(
//       `[CRON] ${jobName} failed:`,
//       error.message
//     );
//   } finally {
//     try {
//       if (locked) {
//         await client.query(
//           `
//           SELECT pg_advisory_unlock(hashtext($1))
//           `,
//           [jobName]
//         );
//       }
//     } catch (unlockError) {
//       console.error(
//         `[CRON] ${jobName} unlock error:`,
//         unlockError.message
//       );
//     }

//     client.release();
//   }
// }

// cron.schedule(
//   "* * * * *",
//   async () => {
//     await runWithLock(
//       "attendance_machine_sync",
//       syncMachineToActivityLog
//     );
//   },
//   {
//     timezone: TIMEZONE,
//   }
// );


// cron.schedule(
//   "* * * * *",
//   async () => {
//     await runWithLock(
//       "activity_to_attendance_logs",
//       syncActivityToAttendanceLogs
//     );
//   },
//   {
//     timezone: TIMEZONE,
//   }
// );

// cron.schedule(
//   "* * * * *",
//   async () => {
//     await runWithLock(
//       "attendance_logs_to_daily",
//       generateDailyAttendance
//     );
//   },
//   {
//     timezone: TIMEZONE,
//   }
// );

// // /* 
// //     DAILY ATTENDANCE GENERATION
// //    Runs at 12:05 AM IST
// //  */
// // cron.schedule(
// //   "5 0 * * *",
// //   async () => {
// //     try {
// //       console.log(" [CRON] Daily attendance generation started");
// //       await generateDailyAttendance();
// //       console.log(" [CRON] Daily attendance generated");
// //     } catch (err) {
// //       console.error(" [CRON] Daily attendance error:", err.message);
// //     }
// //   },
// //   {
// //     timezone: "Asia/Kolkata",
// //   }
// // );

// // /* 
// //     SAFETY SYNC (MISSED PUNCH RECOVERY)
// //    Runs at 6:30 AM IST*/
// // cron.schedule(
// //   "30 6 * * *",
// //   async () => {
// //     try {
// //       console.log(" [CRON] Safety sync started");
// //       await syncAttendance();
// //       await aggregateTodayAttendance(); 
// //       console.log(" [CRON] Safety sync completed");
// //     } catch (err) {
// //       console.error(" [CRON] Safety sync error:", err.message);
// //     }
// //   },
// //   {
// //     timezone: "Asia/Kolkata",
// //   }
// // );


// // // Today Update 
// // async function aggregateTodayAttendance() {
// //   const today = new Date()
// //     .toISOString()
// //     .slice(0, 10); // YYYY-MM-DD

// //   await db.query(
// //     `
// //     INSERT INTO daily_attendance (
// //       emp_id,
// //       attendance_date,
// //       punch_in,
// //       punch_out,
// //       total_hours,
// //       status
// //     )
// //     SELECT
// //       emp_id,
// //       work_date,
// //       MIN(punch_time) AS punch_in,
// //       CASE
// //         WHEN MIN(punch_time) = MAX(punch_time) THEN NULL
// //         ELSE MAX(punch_time)
// //       END AS punch_out,
// //       CASE
// //         WHEN MIN(punch_time) = MAX(punch_time) THEN INTERVAL '0'
// //         ELSE MAX(punch_time) - MIN(punch_time)
// //       END AS total_hours,
// //       CASE
// //         WHEN COUNT(*) = 0 THEN 'Absent'
// //         WHEN MIN(punch_time) = MAX(punch_time) THEN 'Working'
// //         ELSE 'Present'
// //       END AS status
// //     FROM (
// //       SELECT
// //         emp_id,
// //         punch_time AT TIME ZONE 'Asia/Kolkata' AS punch_time,
// //         (punch_time AT TIME ZONE 'Asia/Kolkata')::DATE AS work_date
// //       FROM activity_log
// //       WHERE (punch_time AT TIME ZONE 'Asia/Kolkata')::DATE = $1
// //     ) t
// //     GROUP BY emp_id, work_date
// //     ON CONFLICT (emp_id, attendance_date)
// //     DO UPDATE SET
// //       punch_in = EXCLUDED.punch_in,
// //       punch_out = EXCLUDED.punch_out,
// //       total_hours = EXCLUDED.total_hours,
// //       status = EXCLUDED.status
// //     `,
// //     [today]
// //   );
// // }

// // console.log(" Attendance cron jobs initialized");


const cron = require("node-cron");
const { db } = require("../db/connectDB");
const { syncMachineToActivityLog } = require("../services/activity.log.service");
const { syncActivityToAttendanceLogs } = require("../services/attendance.log.service");
const { generateDailyAttendance } = require("../services/daily.attendance.service");
const { generateWeeklyAttendance } = require("../services/weekly.attendance.service");
const { generateMonthlyAttendance } = require("../services/monthly.attendance.service");

const TIMEZONE = "Asia/Kolkata";

/*
  Generic advisory-lock runner, reused by every job below.
  Each job gets its own connection + its own lock name, so
  jobs never block each other — only overlapping runs of the
  SAME job get skipped.
*/
async function runWithLock(jobName, jobFunction) {
  const client = await db.connect();
  let locked = false;

  try {
    const lockResult = await client.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS locked`,
      [jobName]
    );

    locked = lockResult.rows[0]?.locked === true;

    if (!locked) {
      console.log(`[CRON] ${jobName} skipped - previous run still in progress`);
      return;
    }

    const result = await jobFunction(client);
    console.log(`[CRON] ${jobName} completed:`, result);

  } catch (error) {
    console.error(`[CRON] ${jobName} failed:`, error.message);
  } finally {
    try {
      if (locked) {
        await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [jobName]);
      }
    } catch (unlockError) {
      console.error(`[CRON] ${jobName} unlock error:`, unlockError.message);
    }
    client.release();
  }
}


async function runPipeline(client) {
  const runId = Math.random().toString(36).slice(2, 8);
  console.log(`[CRON][${runId}] pipeline start`)
  const machineResult = await syncMachineToActivityLog(client);
  console.log("[CRON] Stage 1 (machine -> activity_log):", machineResult);
  console.log(`[CRON][${runId}] Stage 1:`, machineResult);

  const activityResult = await syncActivityToAttendanceLogs(client);
  console.log("[CRON] Stage 2 (activity_log -> attendance_logs):", activityResult);
  console.log(`[CRON][${runId}] Stage 2:`, activityResult);
  const dailyResult = await generateDailyAttendance(client);
  console.log("[CRON] Stage 3 (attendance_logs -> daily_attendance):", dailyResult);
  console.log(`[CRON][${runId}] Stage 3:`, dailyResult);
  return { machineResult, activityResult, dailyResult };
}

cron.schedule(
  "* * * * *",
  async () => {
    await runWithLock("attendance_pipeline", runPipeline);
  },
  { timezone: TIMEZONE }
);


cron.schedule(
  "0 11 * * *",
  async () => {
    await runWithLock("weekly_attendance", generateWeeklyAttendance);
  },
  { timezone: TIMEZONE }
);


cron.schedule(
  "0 11 * * *",
  async () => {
    await runWithLock("monthly_attendance", generateMonthlyAttendance);
  },
  { timezone: TIMEZONE }
);


(async () => {
  console.log("[CRON] Running weekly_attendance once on startup...");
  await runWithLock("weekly_attendance", generateWeeklyAttendance);

  console.log("[CRON] Running monthly_attendance once on startup...");
  await runWithLock("monthly_attendance", generateMonthlyAttendance);
})();

module.exports = {};


