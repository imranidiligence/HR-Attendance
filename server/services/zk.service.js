const ZKLib = require("zklib-js");
const { db } = require("../db/connectDB");
const cron = require("node-cron");

// Normalize device punch time
function normalizePunchTime(recordTime) {
  if (!recordTime) return null;
  const parts = recordTime.split(" ");
  if (parts.length < 5) return null;

  const day = parts[2];
  const monthStr = parts[1];
  const year = parts[3];
  const time = parts[4];

  const monthMap = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };

  const month = monthMap[monthStr];
  if (!month) return null;

  return `${year}-${month}-${day} ${time}`;
}

// Fetch and sync punches
async function getDeviceAttendance() {
  const deviceSN = "EUF7251400009";
  const zk = new ZKLib("192.168.0.10", 4370, 10000, 4000);

  try {
    console.log("[SYNC] Connecting to device...");
    await zk.createSocket();
    await zk.enableDevice();

    console.log("[SYNC] Fetching attendance logs...");
    const logs = await zk.getAttendances();

    if (!logs?.data?.length) {
      console.log("[SYNC] No logs found");
      return [];
    }

    /* ---------- LAST SYNC ---------- */
    const { rows: trackerRows } = await db.query(
      `SELECT last_sync FROM attendance_tracker WHERE device_sn = $1`,
      [deviceSN]
    );

    let lastSync = trackerRows[0]?.last_sync || "1970-01-01 00:00:00";
    let lastSyncDate = new Date(lastSync);
    lastSyncDate.setSeconds(lastSyncDate.getSeconds() - 2); // buffer

    /* ---------- FILTER NEW LOGS ---------- */
    const newLogs = logs.data.filter(log => {
      const punchTime = new Date(normalizePunchTime(log.recordTime));
      return punchTime > lastSyncDate;
    });

    console.log(`[SYNC] New punches found: ${newLogs.length}`);

    let latestPunch = lastSyncDate;

    /* ---------- PROCESS LOGS ---------- */
    for (const log of newLogs) {
      const punchTimeStr = normalizePunchTime(log.recordTime);
      if (!punchTimeStr) continue;

      // SAFETY CHECK (THIS FIXES YOUR ERROR)
      const { rows: userRows } = await db.query(
        `SELECT emp_id FROM users WHERE emp_id = $1`,
        [String(log.deviceUserId)]
      );

      if (!userRows.length) {
        // console.warn(
        //   `[SYNC] No employee found for deviceUserId: ${log.deviceUserId}`
        // );
        continue; // skip instead of crashing
      }

      const empId = userRows[0].emp_id;

      await db.query(
        `INSERT INTO activity_log (emp_id, punch_time, device_ip, device_sn)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (emp_id, punch_time) DO NOTHING`,
        [empId, punchTimeStr, log.ip || null, deviceSN]
      );

      const punchDate = new Date(punchTimeStr);
      if (punchDate > latestPunch) latestPunch = punchDate;
    }

    /* ---------- UPDATE LAST SYNC ---------- */
    if (newLogs.length) {
      const finalLastSync = latestPunch
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      await db.query(
        `INSERT INTO attendance_tracker (device_sn, last_sync)
         VALUES ($1, $2)
         ON CONFLICT (device_sn)
         DO UPDATE SET last_sync = EXCLUDED.last_sync`,
        [deviceSN, finalLastSync]
      );
    }

    /* ---------- CLEANUP ---------- */
    await db.query(
      `DELETE FROM activity_log
       WHERE punch_time < NOW() - INTERVAL '2 days'`
    );

    console.log("[SYNC] Punch sync completed successfully");
    return newLogs;

  } catch (err) {
    console.error("[SYNC] Error:", err);
    throw err;
  } finally {
    try {
      await zk.disconnect();
      console.log("[SYNC] Device disconnected");
    } catch {
      console.warn("[SYNC] Device disconnect failed");
    }
  }
}


// 5-minute cron sync
let isSyncRunning = false;
cron.schedule("*/5 * * * *", async () => {
  if (isSyncRunning) {
    console.warn("[CRON] Previous sync still running, skipping");
    return;
  }
  isSyncRunning = true;
  try {
    await getDeviceAttendance();
  } finally {
    isSyncRunning = false;
  }
});

// 
let isSyncRunning2 = false;
cron.schedule("*/1 * * * *", async () => {
  if (isSyncRunning2) {
    console.warn("[CRON] Previous sync still running, skipping");
    return;
  }
  isSyncRunning2 = true;
  try {
    await getDeviceAttendance();
  } finally {
    isSyncRunning2 = false;
  }
});
module.exports = { getDeviceAttendance };
