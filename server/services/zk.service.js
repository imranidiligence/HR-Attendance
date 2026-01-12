const ZKLib = require("zklib-js");
const { db } = require("../db/connectDB");

/* SAFE DATE NORMALIZATION */
function normalizePunchTime(recordTime) {
  if (!recordTime) return null;

  // If already Date object
  if (recordTime instanceof Date) {
    return recordTime.toISOString().replace("T", " ").substring(0, 19);
  }

  // If string
  const date = new Date(recordTime);
  if (isNaN(date)) return null;

  return date.toISOString().replace("T", " ").substring(0, 19);
}

/* DEVICE ATTENDANCE SYNC */
async function getDeviceAttendance() {
  const zk = new ZKLib("192.168.0.10", 4370, 10000, 4000);

  try {
    console.log("[DEVICE] Connecting...");
    await zk.createSocket();
    await zk.disableDevice();

    console.log("[DEVICE] Fetching attendance logs...");
    const logs = await zk.getAttendances();

    if (!logs?.data?.length) {
      console.log("[DEVICE] No attendance logs found");
      return [];
    }

    /* Fetch all valid employees once */
    const { rows: users } = await db.query(`
      SELECT emp_id FROM users
    `);

    const validEmpSet = new Set(users.map(u => String(u.emp_id)));

    const values = [];
    for (const log of logs.data) {
      const punchTime = normalizePunchTime(log.recordTime);
      if (!punchTime) continue;

      const empId = String(log.deviceUserId);
      if (!validEmpSet.has(empId)) continue;

      values.push([
        empId,
        punchTime,
        log.ip || null,
        "EUF7251400009"
      ]);
    }

    if (!values.length) {
      console.log("[DEVICE] No valid logs to insert");
      return [];
    }

    /* BULK INSERT */
    const insertQuery = `
      INSERT INTO attendance_logs
        (emp_id, punch_time, device_ip, device_sn)
      VALUES ${values
        .map(
          (_, i) =>
            `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
        )
        .join(",")}
      ON CONFLICT (emp_id, punch_time) DO NOTHING
    `;

    await db.query(insertQuery, values.flat());

    console.log(`[DEVICE] Synced ${values.length} logs`);
    return values;

  } catch (err) {
    console.error("[DEVICE] Attendance sync error:", err);
    throw err;
  } finally {
    try {
      await zk.enableDevice();
      await zk.disconnect();
      console.log("[DEVICE] Disconnected");
    } catch {
      console.warn("[DEVICE] Disconnect failed");
    }
  }
}

module.exports = { getDeviceAttendance };
