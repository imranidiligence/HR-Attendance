const ZKLib = require("zklib-js");
const {db} = require("../db/connectDB");


function normalizePunchTime(recordTime) {
  /**
   * Input:
   * Fri Jul 18 2025 19:05:36 GMT+0530 (India Standard Time)
   *
   * Output:
   * 2025-07-18 19:05:36
   */

  if (!recordTime) return null;

  const parts = recordTime.split(" ");
  if (parts.length < 5) return null;

  const day = parts[2];
  const monthStr = parts[1];
  const year = parts[3];
  const time = parts[4]; // HH:MM:SS

  const monthMap = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };

  const month = monthMap[monthStr];
  if (!month) return null;

  return `${year}-${month}-${day} ${time}`;
}


async function getDeviceAttendance() {
  const zk = new ZKLib("192.168.0.10", 4370, 10000, 4000);

  try {
    console.log("Connecting to device...");
    await zk.createSocket();
    await zk.enableDevice();

    console.log("Fetching attendance logs...");
    const logs = await zk.getAttendances();

    if (!logs?.data?.length) {
      console.log("No attendance logs found");
      return [];
    }

    for (const log of logs.data) {
      const punchTime = normalizePunchTime(log.recordTime);
      if (!punchTime) continue;

      // TEMP: deviceUserId == emp_id
      const { rows } = await db.query(
        `SELECT emp_id FROM users WHERE emp_id = $1`,
        [String(log.deviceUserId)]
      );

      if (!rows.length) {
        // console.warn(`Unknown device user: ${log.deviceUserId}`);
        continue;
      }

      const empId = rows[0].emp_id;

      await db.query(
        `
        INSERT INTO attendance_logs
          (emp_id, punch_time, device_ip, device_sn)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (emp_id, punch_time) DO NOTHING
        `,
        [
          empId,
          punchTime,
          log.ip || null,
          "EUF7251400009"
        ]
      );
    }

    console.log(` Synced ${logs.data.length} logs`);
    return logs.data;

  } catch (err) {
    console.error(" Attendance sync error FULL:", err);
    throw err;
  } finally {
    try {
      await zk.disconnect();
      console.log("Device disconnected");
    } catch {
      console.warn("Device disconnect failed");
    }
  }
}


module.exports = {
  getDeviceAttendance
};
