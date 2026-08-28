const { getDeviceAttendance } = require("../services/zk.service");

function normalizeMachineLog(log) {
  if (!log) {
    return null;
  }

  const empId =
    log.emp_id ??
    log.empId ??
    log.user_id ??
    log.userId ??
    log.uid;

  const punchTime =
    log.punch_time ??
    log.punchTime ??
    log.timestamp ??
    log.time ??
    log.datetime;

  const deviceIp =
    log.device_ip ??
    log.deviceIp ??
    log.ip ??
    null;

  const deviceSn =
    log.device_sn ??
    log.deviceSn ??
    log.serialNumber ??
    log.sn ??
    null;

  if (
    empId === undefined ||
    empId === null ||
    String(empId).trim() === ""
  ) {
    return null;
  }

  if (
    punchTime === undefined ||
    punchTime === null ||
    String(punchTime).trim() === ""
  ) {
    return null;
  }

  return {
    emp_id: String(empId).trim(),
    punch_time: punchTime,
    device_ip: deviceIp,
    device_sn: deviceSn,
  };
}


/**
 * Inserts machine logs into activity_log.
 *
 * PostgreSQL unique constraint:
 *
 * (emp_id, punch_time)
 *
 * guarantees that historical logs returned again
 * by the machine are ignored.
 */
async function syncMachineToActivityLog(client) {
  console.log("[CRON] Machine sync started");

  const machineResponse = await getDeviceAttendance();
    console.log("[CRON] Machine logs fetched:", machineResponse.length);
  const machineLogs = Array.isArray(machineResponse)
    ? machineResponse
    : Array.isArray(machineResponse?.data)
      ? machineResponse.data
      : [];

      console.log(machineLogs, "logs from activity");

  if (machineLogs.length === 0) {
    console.log("[CRON] Machine returned no logs");
    return;
  }

  const normalizedLogs = machineLogs
    .map(normalizeMachineLog)
    .filter(Boolean);

  if (normalizedLogs.length === 0) {
    console.log(
      "[CRON] Machine returned logs but none were valid"
    );

    return;
  }

  /*
    Build bulk INSERT.

    This is much faster than executing one INSERT
    for every machine record.
  */
  const values = [];
  const placeholders = [];

  let parameterIndex = 1;

  for (const log of normalizedLogs) {
    values.push(
      log.emp_id,
      log.punch_time,
      log.device_ip,
      log.device_sn
    );

    placeholders.push(
      `(
        $${parameterIndex},
        $${parameterIndex + 1},
        $${parameterIndex + 2},
        $${parameterIndex + 3}
      )`
    );

    parameterIndex += 4;
  }

  const query = `
    INSERT INTO public.activity_log
    (
      emp_id,
      punch_time,
      device_ip,
      device_sn
    )
    VALUES
      ${placeholders.join(",")}
    ON CONFLICT (emp_id, punch_time)
    DO NOTHING
  `;

  const result = await client.query(query, values);

  /*
    rowCount = newly inserted rows.
  */

 const inserted = result.rowCount || 0;
  return { received: normalizedLogs.length, inserted };
}



module.exports = { syncMachineToActivityLog };
