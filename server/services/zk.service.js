const ZKLib = require("zklib-js");
const { db } = require("../db/connectDB");
const cron = require("node-cron");
const sendEmail = require("../utils/mailer");

function normalizePunchTime(recordTime) {
  if (!recordTime) return null;
  const parts = recordTime.split(" ");
  if (parts.length < 5) return null;

  const day = parts[2].padStart(2, "0"); // Ensure 2 digits for day
  const monthStr = parts[1];
  const year = parts[3];
  const time = parts[4];

  const monthMap = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const month = monthMap[monthStr];
  if (!month) return null;

  // Append +05:30 so the system knows this is India Time (IST)
  // Format: YYYY-MM-DD HH:mm:ss+05:30
  //   return `${year}-${month}-${day} ${time}+05:30`;
  return `${year}-${month}-${day} ${time}`;
}

// Fetch and sync punches
// async function getDeviceAttendance() {
//   const deviceSN = "EUF7251400009";
//     const deviceIP = "60.254.61.177";
//   const zk = new ZKLib(deviceIP, 4370, 10000, 4000);

//   try {
//     console.log("[SYNC] Connecting to device...");
//     await zk.createSocket();
//     await zk.enableDevice();

//     console.log("[SYNC] Fetching attendance logs...");
//     const logs = await zk.getAttendances();

//     if (!logs?.data?.length) {
//       console.log("[SYNC] No logs found");
//       return [];
//     }

//     /* ---------- LAST SYNC ---------- */
//     const { rows: trackerRows } = await db.query(
//       `SELECT last_sync FROM attendance_tracker WHERE device_sn = $1`,
//       [deviceSN]
//     );

//     let lastSync = trackerRows[0]?.last_sync || "1970-01-01 00:00:00";
//     let lastSyncDate = new Date(lastSync);
//     lastSyncDate.setSeconds(lastSyncDate.getSeconds() - 2); // buffer

//     /* ---------- FILTER NEW LOGS ---------- */
//     const newLogs = logs.data.filter(log => {
//       const punchTime = new Date(normalizePunchTime(log.recordTime));
//       return punchTime > lastSyncDate;
//     });

//     console.log(`[SYNC] New punches found: ${newLogs.length}`);

//     let latestPunch = lastSyncDate;

//     /* ---------- PROCESS LOGS ---------- */
//     for (const log of newLogs) {
//       const punchTimeStr = normalizePunchTime(log.recordTime);
//       if (!punchTimeStr) continue;

//       // SAFETY CHECK
//       const { rows: userRows } = await db.query(
//         `SELECT emp_id FROM users WHERE emp_id = $1`,
//         [String(log.deviceUserId)]
//       );

//       if (!userRows.length) continue; // skip if no employee

//       const empId = userRows[0].emp_id;

//       await db.query(
//         `INSERT INTO activity_log (emp_id, punch_time, device_ip, device_sn)
//          VALUES ($1, $2, $3, $4)
//          ON CONFLICT (emp_id, punch_time) DO NOTHING`,
//         [empId, punchTimeStr, log.ip || null, deviceSN]
//       );

//       const punchDate = new Date(punchTimeStr);
//       if (punchDate > latestPunch) latestPunch = punchDate;

//       /* ---------- SEND EMAIL ---------- */
//       try {
//         const { rows: employeeRows } = await db.query(
//           `SELECT name, email FROM users WHERE emp_id = $1`,
//           [empId]
//         );

//         if (employeeRows.length) {
//           const employee = employeeRows[0];
//           const time = punchDate.toLocaleTimeString("en-IN", { hour12: false });
//           const action = log.type || "in"; // if your device provides type

//           await sendEmail(
//             // employee.email,
//             "s.imran@i-diligence.com",
//             `Punch ${action}`,
//             "punch_in_out",
//             { name: employee.name, action, time }
//           );

//           console.log(` Punch ${action} email sent to ${employee.email}`);
//         }
//       } catch (err) {
//         console.error(" Error sending punch email:", err);
//       }
//     }

//     if (newLogs.length) {
//       const finalLastSync = latestPunch
//         .toISOString()
//         .slice(0, 19)
//         .replace("T", " ");

//       await db.query(
//         `INSERT INTO attendance_tracker (device_sn, last_sync)
//          VALUES ($1, $2)
//          ON CONFLICT (device_sn)
//          DO UPDATE SET last_sync = EXCLUDED.last_sync`,
//         [deviceSN, finalLastSync]
//       );
//     }

//     console.log("[SYNC] Punch sync completed successfully");
//     return newLogs;

//   } catch (err) {
//     console.error("[SYNC] Error:", err);
//     throw err;
//   } finally {
//     try {
//       await zk.disconnect();
//       console.log("[SYNC] Device disconnected");
//     } catch {
//       console.warn("[SYNC] Device disconnect failed");
//     }
//   }
// }

// async function getDeviceAttendance() {
//   const deviceSN = "EUF7251400009";
//   const deviceIP = "60.254.61.177";
//   const zk = new ZKLib(deviceIP, 4370, 10000, 4000);

//   try {
//       console.log("[SYNC] Connecting to device...");
//       await zk.createSocket();
//       await zk.enableDevice();

//       console.log("[SYNC] Fetching attendance logs...");
//       const logs = await zk.getAttendances();

//       if (!logs?.data?.length) {
//           console.log("[SYNC] No logs found");
//           return [];
//       }

//       const { rows: trackerRows } = await db.query(
//           `SELECT last_sync FROM attendance_tracker WHERE device_sn = $1`,
//           [deviceSN]
//       );

//       let lastSync = trackerRows[0]?.last_sync || "1970-01-01 00:00:00";
//       let lastSyncDate = new Date(lastSync);
//       lastSyncDate.setSeconds(lastSyncDate.getSeconds() - 2);

//       const newLogs = logs.data.filter(log => {
//           const punchTime = new Date(normalizePunchTime(log.recordTime));
//           return punchTime > lastSyncDate;
//       });

//       console.log(`[SYNC] New punches found: ${newLogs.length}`);
//       let latestPunch = lastSyncDate;

//       for (const log of newLogs) {
//           const punchTimeStr = normalizePunchTime(log.recordTime);
//           if (!punchTimeStr) continue;

//           const punchDate = new Date(punchTimeStr);

//           const { rows: userRows } = await db.query(
//               `SELECT emp_id, name, email FROM users WHERE emp_id = $1`,
//               [String(log.deviceUserId)]
//           );

//           if (!userRows.length) continue;
//           const employee = userRows[0];

//           await db.query(
//               `INSERT INTO attendance_logs
//                (emp_id, punch_time, device_ip, device_sn, raw_log)
//                VALUES ($1, $2, $3, $4, $5)
//                ON CONFLICT (emp_id, punch_time) DO NOTHING`,
//               [
//                   employee.emp_id,
//                   punchTimeStr,
//                   deviceIP,
//                   deviceSN,
//                   JSON.stringify(log)
//               ]
//           );

//           const insertRes = await db.query(
//               `INSERT INTO activity_log (emp_id, punch_time, device_ip, device_sn)
//                VALUES ($1, $2, $3, $4)
//                ON CONFLICT (emp_id, punch_time) DO NOTHING`,
//               [employee.emp_id, punchTimeStr, deviceIP, deviceSN]
//           );

//           if (punchDate > latestPunch) latestPunch = punchDate;

//           if (insertRes.rowCount > 0) {

//               const timeStr = punchDate.toLocaleTimeString("en-IN", {
//                   hour: '2-digit',
//                   minute: '2-digit',
//                   hour12: true,
//                   timeZone: 'Asia/Kolkata'
//               });

//               const dd = String(punchDate.getDate()).padStart(2, '0');
//               const mm = String(punchDate.getMonth() + 1).padStart(2, '0');
//               const yyyy = punchDate.getFullYear();
//               const formattedDate = `${dd}-${mm}-${yyyy}`;

//               const dayName = punchDate.toLocaleDateString('en-IN', {
//                   weekday: 'long',
//                   timeZone: 'Asia/Kolkata'
//               });

//               const action = log.type || "Punch";

//               try {

//                   const { rows: firstPunchRow } = await db.query(
//                       `SELECT MIN(punch_time) as first_punch
//                        FROM activity_log
//                        WHERE emp_id = $1
//                        AND punch_time::DATE = $2::DATE`,
//                       [employee.emp_id, punchTimeStr]
//                   );

//                   let punchInTime = timeStr;
//                   let totalDuration = "Initial Punch";
//                   let showSummary = false;

//                   if (firstPunchRow[0]?.first_punch) {

//                       const firstPunchDate = new Date(firstPunchRow[0].first_punch);

//                       punchInTime = firstPunchDate.toLocaleTimeString("en-IN", {
//                           hour: '2-digit',
//                           minute: '2-digit',
//                           hour12: true,
//                           timeZone: 'Asia/Kolkata'
//                       });

//                       const diffMs = punchDate - firstPunchDate;

//                       if (diffMs > 60000) {
//                           const totalMinutes = Math.floor(diffMs / 60000);
//                           const hours = Math.floor(totalMinutes / 60);
//                           const minutes = totalMinutes % 60;

//                           totalDuration = `${hours}h ${minutes}m`;
//                           showSummary = true;
//                       }
//                   }

//                   // await sendEmail(
//                   //     employee.email,
//                   //     // "s.imran@i-diligence.com",
//                   //     `Attendance Notification: ${action}`,
//                   //     "punch_in_out",
//                   //     {
//                   //         name: employee.name,
//                   //         emp_id: employee.emp_id,
//                   //         action,
//                   //         date: formattedDate,
//                   //         day: dayName,
//                   //         time: timeStr,
//                   //         punch_in: punchInTime,
//                   //         punch_out: showSummary ? timeStr : "---",
//                   //         duration: totalDuration,
//                   //         is_out: showSummary
//                   //     }
//                   // );

//                   console.log("Email sent to:", employee.email);

//               } catch (emailErr) {
//                   console.error("Email error:", emailErr);
//               }
//           }
//       }

//       if (newLogs.length) {
//           const finalLastSync = latestPunch.toISOString().slice(0, 19).replace("T", " ");
//           await db.query(
//               `INSERT INTO attendance_tracker (device_sn, last_sync)
//                VALUES ($1, $2)
//                ON CONFLICT (device_sn)
//                DO UPDATE SET last_sync = EXCLUDED.last_sync`,
//               [deviceSN, finalLastSync]
//           );
//       }

//       console.log("[SYNC] Completed successfully");
//       return newLogs;

//   } catch (err) {
//       console.error("[SYNC] Error:", err);
//       throw err;
//   } finally {
//       try {
//           await zk.disconnect();
//           console.log("[SYNC] Device disconnected");
//       } catch {
//           console.warn("[SYNC] Device disconnect failed");
//       }
//   }
// }

function formatLocalDateTime(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0"); // months are 0-indexed
  const yyyy = date.getFullYear();

  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+05:30`;
}

// async function getDeviceAttendance() {
//     const deviceSN = "EUF7251400009";
//     const deviceIP = "60.254.61.177";
//     const zk = new ZKLib(deviceIP, 4370, 10000, 4000);

//     // Helper to format Date to IST with +05:30 offset
//     function formatISTWithOffset(date) {
//         if (!(date instanceof Date) || isNaN(date.getTime())) return null;

//         const yyyy = date.getFullYear();
//         const mm = String(date.getMonth() + 1).padStart(2, "0");
//         const dd = String(date.getDate()).padStart(2, "0");

//         const hh = String(date.getHours()).padStart(2, "0");
//         const min = String(date.getMinutes()).padStart(2, "0");
//         const ss = String(date.getSeconds()).padStart(2, "0");

//         const offset = "+05:30"; // IST
//         return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}${offset}`;
//     }

//     try {
//         console.log("[SYNC] Connecting to device...");
//         await zk.createSocket();
//         await zk.enableDevice();

//         console.log("[SYNC] Fetching attendance logs...");
//         const logs = await zk.getAttendances();
//         if (!logs?.data?.length) {
//             console.log("[SYNC] No logs found");
//             return [];
//         }

//         const { rows: trackerRows } = await db.query(
//             `SELECT last_sync FROM attendance_tracker WHERE device_sn = $1`,
//             [deviceSN]
//         );

//         let lastSync = trackerRows[0]?.last_sync || "1970-01-01 00:00:00";
//         let lastSyncDate = new Date(lastSync);
//         lastSyncDate.setSeconds(lastSyncDate.getSeconds() - 2);

//         const newLogs = logs.data.filter(log => {
//             const punchTime = new Date(normalizePunchTime(log.recordTime));
//             return punchTime > lastSyncDate;
//         });

//         console.log(`[SYNC] New punches found: ${newLogs.length}`);
//         let latestPunch = lastSyncDate;

//         for (const log of newLogs) {
//             const punchTimeStr = normalizePunchTime(log.recordTime);
//             if (!punchTimeStr) continue;

//             const punchDate = new Date(punchTimeStr); //
//             if (isNaN(punchDate.getTime())) continue;

//             const { rows: userRows } = await db.query(
//                 `SELECT emp_id, name, email FROM users WHERE emp_id = $1`,
//                 [String(log.deviceUserId)]
//             );
//             if (!userRows.length) continue;
//             const employee = userRows[0];

//             const formattedPunch = formatISTWithOffset(punchDate);

//             // --- Insert into attendance_logs ---
//             await db.query(
//                 `INSERT INTO attendance_logs
//                  (emp_id, punch_time, device_ip, device_sn, raw_log)
//                  VALUES ($1, $2, $3, $4, $5)
//                  ON CONFLICT (emp_id, punch_time) DO NOTHING`,
//                 [employee.emp_id, formattedPunch, deviceIP, deviceSN, JSON.stringify(log)]
//             );

//             // --- Insert into activity_log ---
//            const insertRes =  await db.query(
//                 `INSERT INTO activity_log (emp_id, punch_time, device_ip, device_sn)
//                  VALUES ($1, $2, $3, $4)
//                  ON CONFLICT (emp_id, punch_time) DO NOTHING`,
//                 [employee.emp_id, formattedPunch, deviceIP, deviceSN]
//             );

//             if (punchDate > latestPunch) latestPunch = punchDate;

//             const dayStr = punchDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

//                 let firstPunch, lastPunch;
//                 let emailNeeded = false;
//                 let durationStr = "Initial Punch";

//             const { rows: dailyRow } = await db.query(
//                 `SELECT * FROM daily_attendance
//                 WHERE emp_id = $1 AND attendance_date = $2`,
//                 [employee.emp_id, dayStr]
//             );

// // if (dailyRow.length > 0) {
// //     const existing = dailyRow[0];

// //     console.log("Existing",existing);

// //     firstPunch = new Date(existing.punch_in);
// //     lastPunch = existing.punch_out ? new Date(existing.punch_out) : null;

// //     console.log("PunchDate",punchDate);
// //     console.log("firstPunch",firstPunch);
// //     console.log("lastPunch",lastPunch);

// //     if (!existing.punch_out || punchDate <= firstPunch || punchDate >= lastPunch) {
// //         if (punchDate < firstPunch) firstPunch = punchDate;

// //         console.log("punchDate < firstPunch",firstPunch);

// //         if (punchDate >= lastPunch) lastPunch = punchDate;

// //         console.log("punchDate > lastPunch",lastPunch);

// //         // emailNeeded = true;
// //     }

// //     const diffMs = lastPunch - firstPunch;
// //     const hours = Math.floor(diffMs / 3600000);
// //     const minutes = Math.floor((diffMs % 3600000) / 60000);
// //     durationStr = `${hours}h ${minutes}m`;

// //     const status = lastPunch ? "Present" : "Working";

// //     await db.query(
// //         `UPDATE daily_attendance
// //          SET punch_in = $1,
// //              punch_out = $2,
// //              total_hours = $3,
// //              status = $4
// //          WHERE emp_id = $5
// //          AND attendance_date = $6`,
// //         [
// //             formatISTWithOffset(firstPunch),
// //             lastPunch ? formatISTWithOffset(lastPunch) : null,
// //             durationStr,
// //             status,
// //             employee.emp_id,
// //             dayStr
// //         ]
// //     );
// // } else {
// //     // FIRST PUNCH
// //     firstPunch = punchDate;
// //     lastPunch = null;
// //     durationStr = "Initial Punch";
// //     emailNeeded = true;

// //     console.log("FirstPunch",firstPunch);
// //     console.log("LastPunch",lastPunch);

// //     await db.query(
// //         `INSERT INTO daily_attendance
// //          (emp_id, attendance_date, punch_in, punch_out, total_hours, status)
// //          VALUES ($1,$2,$3,$4,$5,$6)`,
// //         [
// //             employee.emp_id,
// //             dayStr,
// //             formattedPunch,
// //             null,
// //             null,
// //             "Working"
// //         ]
// //     );
// // }
// if (dailyRow.length > 0) {
//     const existing = dailyRow[0];

//     // Convert existing DB strings back to Date objects for comparison
//     const dbPunchIn = new Date(existing.punch_in);
//     const dbPunchOut = existing.punch_out ? new Date(existing.punch_out) : null;

//     let needsUpdate = false;
//     firstPunch = dbPunchIn;
//     lastPunch = dbPunchOut;

//     // 1. Check if this is an EARLIER punch (Update Punch In)
//     // We use a 1-minute buffer to avoid micro-second differences causing double emails
//     if (punchDate < (new Date(dbPunchIn.getTime() - 60000))) {
//         firstPunch = punchDate;
//         needsUpdate = true;
//     }
//     // 2. Check if this is a LATER punch (Update Punch Out)
//     else if (!dbPunchOut || punchDate > (new Date(dbPunchOut.getTime() + 60000))) {
//         lastPunch = punchDate;
//         needsUpdate = true;
//     }

//     if (needsUpdate) {
//         // Calculate Duration
//         const diffMs = lastPunch - firstPunch;
//         const hours = Math.floor(diffMs / 3600000);
//         const minutes = Math.floor((diffMs % 3600000) / 60000);
//         durationStr = `${hours}h ${minutes}m`;

//         const status = "Present"; // If we have a punch out, they are present

//         await db.query(
//             `UPDATE daily_attendance
//              SET punch_in = $1, punch_out = $2, total_hours = $3, status = $4
//              WHERE emp_id = $5 AND attendance_date = $6`,
//             [
//                 formatISTWithOffset(firstPunch),
//                 formatISTWithOffset(lastPunch),
//                 durationStr,
//                 status,
//                 employee.emp_id,
//                 dayStr
//             ]
//         );

//         emailNeeded = true; // TRIGGER MAIL ONLY ON CHANGE
//     }

// } else {
//     // --- CASE: NEW ROW (FIRST PUNCH) ---
//     firstPunch = punchDate;
//     lastPunch = null;
//     durationStr = "Initial Punch";
//     emailNeeded = true;

//     await db.query(
//         `INSERT INTO daily_attendance
//          (emp_id, attendance_date, punch_in, punch_out, total_hours, status)
//          VALUES ($1, $2, $3, $4, $5, $6)`,
//         [
//             employee.emp_id,
//             dayStr,
//             formatISTWithOffset(firstPunch),
//             null,
//             null,
//             "Working"
//         ]
//     );
// }
// console.log("emailNeeded",emailNeeded);

//             // --- Send email only if first or last punch changed ---
//             if (emailNeeded) {
//                 const punchInTimeStr = firstPunch.toLocaleTimeString("en-IN", {
//                     hour: '2-digit',
//                     minute: '2-digit',
//                     hour12: true,
//                     timeZone: 'Asia/Kolkata'
//                 });
//                 const punchOutTimeStr =  durationStr === "Initial Punch"
//         ? "Initial Punch":  lastPunch.toLocaleTimeString("en-IN", {
//                     hour: '2-digit',
//                     minute: '2-digit',
//                     hour12: true,
//                     timeZone: 'Asia/Kolkata'
//                 });

//                 // const empEmail = process.env.NODE_ENV === "production" ? employee.email : "s.imran@i-diligence.com"

//                 // console.log("empEmail",empEmail);

//                 const formattedDate = `${String(firstPunch.getDate()).padStart(2, '0')}-${String(firstPunch.getMonth() + 1).padStart(2, '0')}-${firstPunch.getFullYear()}`;
//                 const dayName = firstPunch.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

//                 try {
//                     await sendEmail(
//                         // employee.email,
//                         "s.imran@i-diligence.com",
//                         `Attendance Notification: Punch`,
//                         "punch_in_out",
//                         {
//                             name: employee.name,
//                             emp_id: employee.emp_id,
//                             action: "Punch",
//                             date: formattedDate,
//                             day: dayName,
//                             time: formattedPunch,
//                             punch_in: punchInTimeStr,
//                             punch_out: punchOutTimeStr,
//                             duration: durationStr,
//                             is_out: punchOutTimeStr !== punchInTimeStr
//                         }
//                     );

//                     console.log("Email sent to:", employee.email);
//                 } catch (emailErr) {
//                     console.error("Email error:", emailErr);
//                 }
//             }
//         }

//         // --- Update attendance_tracker ---
//         if (newLogs.length) {
//             const finalLastSync = formatISTWithOffset(latestPunch);
//             await db.query(
//                 `INSERT INTO attendance_tracker (device_sn, last_sync)
//                  VALUES ($1, $2)
//                  ON CONFLICT (device_sn)
//                  DO UPDATE SET last_sync = EXCLUDED.last_sync`,
//                 [deviceSN, finalLastSync]
//             );
//         }

//         console.log("[SYNC] Completed successfully");
//         return newLogs;

//     } catch (err) {
//         console.error("[SYNC] Error:", err);
//         throw err;
//     } finally {
//         try {
//             await zk.disconnect();
//             console.log("[SYNC] Device disconnected");
//         } catch {
//             console.warn("[SYNC] Device disconnect failed");
//         }
//     }
// }

// async function getDeviceAttendance() {
//     const deviceSN = "EUF7251400009";
//     const deviceIP = "60.254.61.177";
//     const zk = new ZKLib(deviceIP, 4370, 10000, 4000);

//     // Helper to format Date to IST with +05:30 offset
//     function formatISTWithOffset(date) {
//         if (!(date instanceof Date) || isNaN(date.getTime())) return null;

//         const yyyy = date.getFullYear();
//         const mm = String(date.getMonth() + 1).padStart(2, "0");
//         const dd = String(date.getDate()).padStart(2, "0");

//         const hh = String(date.getHours()).padStart(2, "0");
//         const min = String(date.getMinutes()).padStart(2, "0");
//         const ss = String(date.getSeconds()).padStart(2, "0");

//         const offset = "+05:30"; // IST
//         return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}${offset}`;
//     }

//     try {
//         console.log("[SYNC] Connecting to device...");
//         await zk.createSocket();
//         await zk.enableDevice();

//         console.log("[SYNC] Fetching attendance logs...");
//         const logs = await zk.getAttendances();
//         if (!logs?.data?.length) {
//             console.log("[SYNC] No logs found");
//             return [];
//         }

//         const { rows: trackerRows } = await db.query(
//             `SELECT last_sync FROM attendance_tracker WHERE device_sn = $1`,
//             [deviceSN]
//         );

//         let lastSync = trackerRows[0]?.last_sync || "1970-01-01 00:00:00";
//         let lastSyncDate = new Date(lastSync);
//         lastSyncDate.setSeconds(lastSyncDate.getSeconds() - 2);

//         const newLogs = logs.data.filter(log => {
//             const punchTime = new Date(normalizePunchTime(log.recordTime));
//             return punchTime > lastSyncDate;
//         });

//         console.log(`[SYNC] New punches found: ${newLogs.length}`);
//         let latestPunch = lastSyncDate;

//         for (const log of newLogs) {
//             const punchTimeStr = normalizePunchTime(log.recordTime);
//             if (!punchTimeStr) continue;

//             const punchDate = new Date(punchTimeStr); //
//             if (isNaN(punchDate.getTime())) continue;

//             const { rows: userRows } = await db.query(
//                 `SELECT emp_id, name, email FROM users WHERE emp_id = $1`,
//                 [String(log.deviceUserId)]
//             );
//             if (!userRows.length) continue;
//             const employee = userRows[0];

//             const formattedPunch = formatISTWithOffset(punchDate);

//             // --- Insert into attendance_logs ---
//             await db.query(
//                 `INSERT INTO attendance_logs
//                  (emp_id, punch_time, device_ip, device_sn, raw_log)
//                  VALUES ($1, $2, $3, $4, $5)
//                  ON CONFLICT (emp_id, punch_time) DO NOTHING`,
//                 [employee.emp_id, formattedPunch, deviceIP, deviceSN, JSON.stringify(log)]
//             );

//             // --- Insert into activity_log ---
//             const insertRes = await db.query(
//                 `INSERT INTO activity_log (emp_id, punch_time, device_ip, device_sn)
//                  VALUES ($1, $2, $3, $4)
//                  ON CONFLICT (emp_id, punch_time) DO NOTHING`,
//                 [employee.emp_id, formattedPunch, deviceIP, deviceSN]
//             );

//             if (punchDate > latestPunch) latestPunch = punchDate;

//             // --- Daily Attendance Update ---
//             // const dayStr = punchDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
//             // let firstPunch, lastPunch;
//             // let emailNeeded = false;
//             // let durationStr = "Initial Punch";

//             // const { rows: dailyRow } = await db.query(
//             //     `SELECT * FROM daily_attendance
//             //      WHERE emp_id = $1 AND attendance_date = $2`,
//             //     [employee.emp_id, dayStr]
//             // );

//             // if (dailyRow.length) {

//             //     // Existing Record
//             //     const existing = dailyRow[0];
//             //     firstPunch = new Date(existing.punch_in);
//             //     lastPunch = new Date(existing.punch_out);

//             //     if (punchDate < firstPunch) {
//             //         firstPunch = punchDate;
//             //         emailNeeded = true;
//             //     }
//             //     if (punchDate > lastPunch) {
//             //         lastPunch = punchDate;
//             //         emailNeeded = true;
//             //     }

//             //     const diffMs = lastPunch - firstPunch;
//             //     const hours = Math.floor(diffMs / 3600000);
//             //     const minutes = Math.floor((diffMs % 3600000) / 60000);
//             //     durationStr = `${hours}h ${minutes}m`;

//             //     await db.query(
//             //         `UPDATE daily_attendance
//             //          SET punch_in = $1, punch_out = $2, total_hours = $3
//             //          WHERE emp_id = $4 AND attendance_date = $5`,
//             //         [
//             //             formatISTWithOffset(firstPunch),
//             //             formatISTWithOffset(lastPunch),
//             //             durationStr,
//             //             employee.emp_id,
//             //             dayStr
//             //         ]
//             //     );
//             // }
//             // else {
//             //     firstPunch = lastPunch = punchDate;
//             //     durationStr = "Initial Punch";
//             //     emailNeeded = true;

//             //     await db.query(
//             //         `INSERT INTO daily_attendance (emp_id, attendance_date, punch_in, punch_out, total_hours)
//             //          VALUES ($1, $2, $3, $4, $5)`,
//             //         // [employee.emp_id, dayStr, formattedPunch, formattedPunch, durationStr]
//             //         [employee.emp_id, dayStr, formattedPunch, "Initial Punch", "Initial Punch"]
//             //     );
//             // }

//             //

//             const dayStr = punchDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

//             // console.log("dayStr",dayStr);
//             let firstPunch, lastPunch;
//             let emailNeeded = false;
//             let durationStr = "Initial Punch";

//             const { rows: dailyRow } = await db.query(
//                 `SELECT * FROM daily_attendance
//      WHERE emp_id = $1 AND attendance_date = $2`,
//                 [employee.emp_id, dayStr]
//             );

//             console.log("dailyRow.length", dailyRow);

//             // if (dailyRow.length) {
//             //     const existing = dailyRow[0];
//             //     firstPunch = new Date(existing.punch_in);
//             //     lastPunch = existing.punch_out ? new Date(existing.punch_out) : null;

//             //     if (!existing.punch_out || punchDate < firstPunch || punchDate > lastPunch) {
//             //         if (punchDate < firstPunch) firstPunch = punchDate;
//             //         if (punchDate > lastPunch) lastPunch = punchDate;
//             //         emailNeeded = true;
//             //     }

//             //     const diffMs = lastPunch - firstPunch;
//             //     const hours = Math.floor(diffMs / 3600000);
//             //     const minutes = Math.floor((diffMs % 3600000) / 60000);
//             //     durationStr = `${hours}h ${minutes}m`;

//             //     const status = lastPunch ? "Present" : "Working";

//             //     await db.query(
//             //         `UPDATE daily_attendance
//             //          SET punch_in = $1,
//             //              punch_out = $2,
//             //              total_hours = $3,
//             //              status = $4
//             //          WHERE emp_id = $5
//             //          AND attendance_date = $6`,
//             //         [
//             //             formatISTWithOffset(firstPunch),
//             //             lastPunch ? formatISTWithOffset(lastPunch) : null,
//             //             durationStr,
//             //             status,
//             //             employee.emp_id,
//             //             dayStr
//             //         ]
//             //     );
//             // }

//             // if (dailyRow.length) {

//             //     const existing = dailyRow[0];

//             //     firstPunch = new Date(existing.punch_in);
//             //     lastPunch = existing.punch_out ? new Date(existing.punch_out) : null;

//             //     let changed = false;

//             //     console.log("punchDate",punchDate);

//             //     // Earlier punch
//             //     if (punchDate < firstPunch) {
//             //         firstPunch = punchDate;
//             //         changed = true;
//             //     }

//             //     // Later punch (Punch Out)
//             //     if (!lastPunch || punchDate > lastPunch) {
//             //         lastPunch = punchDate;
//             //         changed = true;
//             //     }

//             //     if (!changed) continue;

//             //     emailNeeded = true;

//             //     if (lastPunch) {
//             //         const diffMs = lastPunch - firstPunch;

//             //         const hours = Math.floor(diffMs / 3600000);
//             //         const minutes = Math.floor((diffMs % 3600000) / 60000);

//             //         durationStr = `${hours}h ${minutes}m`;
//             //     }

//             //     const status = lastPunch ? "Present" : "Working";

//             //     await db.query(
//             //         `UPDATE daily_attendance
//             //          SET punch_in = $1,
//             //              punch_out = $2,
//             //              total_hours = $3,
//             //              status = $4
//             //          WHERE emp_id = $5
//             //          AND attendance_date = $6`,
//             //         [
//             //             formatISTWithOffset(firstPunch),
//             //             lastPunch ? formatISTWithOffset(lastPunch) : null,
//             //             durationStr,
//             //             status,
//             //             employee.emp_id,
//             //             dayStr
//             //         ]
//             //     );
//             // }
//             // else {
//             //     // FIRST PUNCH
//             //     firstPunch = punchDate;
//             //     lastPunch = null;
//             //     durationStr = "Initial Punch";
//             //     emailNeeded = true;

//             //     await db.query(
//             //         `INSERT INTO daily_attendance
//             //          (emp_id, attendance_date, punch_in, punch_out, total_hours, status)
//             //          VALUES ($1,$2,$3,$4,$5,$6)`,
//             //         [
//             //             employee.emp_id,
//             //             dayStr,
//             //             formattedPunch,
//             //             null,
//             //             null,
//             //             "Working"
//             //         ]
//             //     );
//             // }

//         //     if (dailyRow.length) {

//         //         const existing = dailyRow[0];

//         //         firstPunch = new Date(existing.punch_in);
//         //         lastPunch = existing.punch_out ? new Date(existing.punch_out) : null;

//         //         // CASE 1 → Punch Out
//         //         if (!lastPunch && punchDate > firstPunch) {

//         //             lastPunch = punchDate;
//         //             emailNeeded = true;

//         //             const diffMs = lastPunch - firstPunch;
//         //             const hours = Math.floor(diffMs / 3600000);
//         //             const minutes = Math.floor((diffMs % 3600000) / 60000);

//         //             durationStr = `${hours}h ${minutes}m`;

//         //             await db.query(
//         //                 `UPDATE daily_attendance
//         //                 SET punch_out = $1,
//         //                     total_hours = $2,
//         //                     status = $3
//         //                 WHERE emp_id = $4
//         //                 AND attendance_date = $5`,
//         //                 [
//         //                     formatISTWithOffset(lastPunch),
//         //                     durationStr,
//         //                     "Present",
//         //                     employee.emp_id,
//         //                     dayStr
//         //                 ]
//         //             );
//         //         }

//         //     }
//         //     else {

//         //         // CASE 2 → First Punch (Punch In)

//         //         firstPunch = punchDate;
//         //         lastPunch = null;

//         //         emailNeeded = true;
//         //         durationStr = "Initial Punch";

//         //         await db.query(
//         //             `INSERT INTO daily_attendance
//         //  (emp_id, attendance_date, punch_in, punch_out, total_hours, status)
//         //  VALUES ($1,$2,$3,$4,$5,$6)`,
//         //             [
//         //                 employee.emp_id,
//         //                 dayStr,
//         //                 formatISTWithOffset(firstPunch),
//         //                 null,
//         //                 null,
//         //                 "Working"
//         //             ]
//         //         );
//         //     }

//         // ... after fetching dailyRow ...

// let currentStatus = "";

// if (dailyRow.length > 0) {
//     const existing = dailyRow[0];
//     firstPunch = new Date(existing.punch_in);
//     lastPunch = existing.punch_out ? new Date(existing.punch_out) : null;

//     // Only update if this new punch is LATER than the existing first punch
//     // AND we don't already have a punch_out (or this is later than current punch_out)
//     if (punchDate > firstPunch && (!lastPunch || punchDate > lastPunch)) {
//         lastPunch = punchDate;
//         emailNeeded = true;
//         currentStatus = "Present";

//         const diffMs = lastPunch - firstPunch;
//         const hours = Math.floor(diffMs / 3600000);
//         const minutes = Math.floor((diffMs % 3600000) / 60000);
//         durationStr = `${hours}h ${minutes}m`;

//         await db.query(
//             `UPDATE daily_attendance
//              SET punch_out = $1, total_hours = $2, status = $3
//              WHERE emp_id = $4 AND attendance_date = $5`,
//             [formatISTWithOffset(lastPunch), durationStr, currentStatus, employee.emp_id, dayStr]
//         );
//     } else {
//         // It's a duplicate or an earlier punch we already handled
//         emailNeeded = false;
//     }
// } else {
//     // CASE: First Punch of the day (Punch In)
//     firstPunch = punchDate;
//     lastPunch = null; // Ensure this is null, not "Initial Punch" string
//     emailNeeded = true;
//     durationStr = "Initial Punch";
//     currentStatus = "Working";

//     await db.query(
//         `INSERT INTO daily_attendance
//          (emp_id, attendance_date, punch_in, punch_out, total_hours, status)
//          VALUES ($1, $2, $3, $4, $5, $6)`,
//         [employee.emp_id, dayStr, formatISTWithOffset(firstPunch), null, durationStr, currentStatus]
//     );
// }

// // --- Send email only if emailNeeded is true ---
// if (emailNeeded) {
//     const punchInTimeStr = firstPunch.toLocaleTimeString("en-IN", {
//         hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
//     });

//     // logic to prevent "Initial Punch" text appearing awkwardly
//     const punchOutTimeStr = (lastPunch)
//         ? lastPunch.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
//         : "Initial Punch";

//     await sendEmail(
//         "s.imran@i-diligence.com",
//         `Attendance Notification: ${lastPunch ? "Punch Out" : "Punch In"}`,
//         "punch_in_out",
//         {
//             name: employee.name,
//             emp_id: employee.emp_id,
//             action: lastPunch ? "Punch Out" : "Punch In",
//             date: formattedDate,
//             day: dayName,
//             time: formattedPunch,
//             punch_in: punchInTimeStr,
//             punch_out: punchOutTimeStr,
//             duration: durationStr,
//             is_out: !!lastPunch // true if it's a punch out
//         }
//     );
// }
//             // --- Send email only if first or last punch changed ---
//             if (emailNeeded) {
//                 const punchInTimeStr = firstPunch.toLocaleTimeString("en-IN", {
//                     hour: '2-digit',
//                     minute: '2-digit',
//                     hour12: true,
//                     timeZone: 'Asia/Kolkata'
//                 });

//                 const punchOutTimeStr = lastPunch
//                     ? lastPunch.toLocaleTimeString("en-IN", {
//                         hour: '2-digit',
//                         minute: '2-digit',
//                         hour12: true,
//                         timeZone: 'Asia/Kolkata'
//                     })
//                     : "Initial Punch";

//                 // const empEmail = process.env.NODE_ENV === "production" ? employee.email : "s.imran@i-diligence.com"

//                 // console.log("empEmail",empEmail);

//                 const formattedDate = `${String(firstPunch.getDate()).padStart(2, '0')}-${String(firstPunch.getMonth() + 1).padStart(2, '0')}-${firstPunch.getFullYear()}`;
//                 const dayName = firstPunch.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });

//                 try {
//                     await sendEmail(
//                         "s.imran@i-diligence.com",
//                         // employee.email,
//                         `Attendance Notification: Punch`,
//                         "punch_in_out",
//                         {
//                             name: employee.name,
//                             emp_id: employee.emp_id,
//                             action: "Punch",
//                             date: formattedDate,
//                             day: dayName,
//                             time: formattedPunch,
//                             punch_in: punchInTimeStr,
//                             punch_out: punchOutTimeStr,
//                             duration: durationStr,
//                             is_out: punchOutTimeStr !== punchInTimeStr
//                         }
//                     );

//                     console.log("Email sent to:", employee.email);
//                 } catch (emailErr) {
//                     console.error("Email error:", emailErr);
//                 }
//             }
//         }

//         // --- Update attendance_tracker ---
//         if (newLogs.length) {
//             const finalLastSync = formatISTWithOffset(latestPunch);
//             await db.query(
//                 `INSERT INTO attendance_tracker (device_sn, last_sync)
//                  VALUES ($1, $2)
//                  ON CONFLICT (device_sn)
//                  DO UPDATE SET last_sync = EXCLUDED.last_sync`,
//                 [deviceSN, finalLastSync]
//             );
//         }

//         console.log("[SYNC] Completed successfully");
//         return newLogs;

//     } catch (err) {
//         console.error("[SYNC] Error:", err);
//         throw err;
//     } finally {
//         try {
//             await zk.disconnect();
//             console.log("[SYNC] Device disconnected");
//         } catch {
//             console.warn("[SYNC] Device disconnect failed");
//         }
//     }
// }

// async function getDeviceAttendance() {
//     const deviceSN = "EUF7251400009";
//     const deviceIP = "60.254.61.177";
//     const zk = new ZKLib(deviceIP, 4370, 10000, 4000);

//     const DUPLICATE_THRESHOLD = 30 * 1000;

//     function formatISTWithOffset(date) {
//         if (!(date instanceof Date) || isNaN(date.getTime())) return null;

//         const yyyy = date.getFullYear();
//         const mm = String(date.getMonth() + 1).padStart(2, "0");
//         const dd = String(date.getDate()).padStart(2, "0");
//         const hh = String(date.getHours()).padStart(2, "0");
//         const min = String(date.getMinutes()).padStart(2, "0");
//         const ss = String(date.getSeconds()).padStart(2, "0");

//         return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}+05:30`;
//     }

//     try {

//         console.log("[SYNC] Connecting device...");
//         await zk.createSocket();
//         await zk.enableDevice();

//         const logs = await zk.getAttendances();
//         if (!logs?.data?.length) return [];

//         const { rows: trackerRows } = await db.query(
//             `SELECT last_sync FROM attendance_tracker WHERE device_sn = $1`,
//             [deviceSN]
//         );

//         let lastSync = trackerRows[0]?.last_sync || "1970-01-01 00:00:00";
//         let lastSyncDate = new Date(lastSync);
//         lastSyncDate.setSeconds(lastSyncDate.getSeconds() - 2);

//         const newLogs = logs.data.filter(log => {
//             const punchTime = new Date(normalizePunchTime(log.recordTime));
//             return punchTime > lastSyncDate;
//         });

//         console.log("New punches:", newLogs.length);

//         let latestPunch = lastSyncDate;

//         for (const log of newLogs) {

//             const punchTimeStr = normalizePunchTime(log.recordTime);
//             if (!punchTimeStr) continue;

//             const punchDate = new Date(punchTimeStr);
//             if (isNaN(punchDate.getTime())) continue;

//             const { rows: userRows } = await db.query(
//                 `SELECT emp_id,name,email FROM users WHERE emp_id=$1`,
//                 [String(log.deviceUserId)]
//             );

//             if (!userRows.length) continue;

//             const employee = userRows[0];
//             const formattedPunch = formatISTWithOffset(punchDate);

//             await db.query(
//                 `INSERT INTO attendance_logs
//                  (emp_id,punch_time,device_ip,device_sn,raw_log)
//                  VALUES ($1,$2,$3,$4,$5)
//                  ON CONFLICT (emp_id,punch_time) DO NOTHING`,
//                 [
//                     employee.emp_id,
//                     formattedPunch,
//                     deviceIP,
//                     deviceSN,
//                     JSON.stringify(log)
//                 ]
//             );

//             await db.query(
//                 `INSERT INTO activity_log
//                  (emp_id,punch_time,device_ip,device_sn)
//                  VALUES ($1,$2,$3,$4)
//                  ON CONFLICT (emp_id,punch_time) DO NOTHING`,
//                 [
//                     employee.emp_id,
//                     formattedPunch,
//                     deviceIP,
//                     deviceSN
//                 ]
//             );

//             if (punchDate > latestPunch) latestPunch = punchDate;

//             const dayStr = punchDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

//             const { rows: dailyRow } = await db.query(
//                 `SELECT * FROM daily_attendance
//                  WHERE emp_id=$1 AND attendance_date=$2`,
//                 [employee.emp_id, dayStr]
//             );

//             let firstPunch, lastPunch;
//             let emailNeeded = false;
//             let durationStr = null;

//             if (dailyRow.length) {

//                 const existing = dailyRow[0];

//                 firstPunch = new Date(existing.punch_in);
//                 lastPunch = existing.punch_out ? new Date(existing.punch_out) : null;

//                 const isSamePunchIn =
//                     Math.abs(punchDate - firstPunch) < DUPLICATE_THRESHOLD;

//                 const isSamePunchOut =
//                     lastPunch && Math.abs(punchDate - lastPunch) < DUPLICATE_THRESHOLD;

//                 if (isSamePunchIn || isSamePunchOut) {
//                     console.log("Duplicate punch ignored");
//                     continue;
//                 }

//                 if (punchDate < firstPunch) {
//                     firstPunch = punchDate;
//                     emailNeeded = true;
//                 }

//                 if (!lastPunch || punchDate > lastPunch) {
//                     lastPunch = punchDate;
//                     emailNeeded = true;
//                 }
//                 const changed =
//                     firstPunch.getTime() !== new Date(existing.punch_in).getTime() ||
//                     (lastPunch && existing.punch_out !== formatISTWithOffset(lastPunch));

//                 if (!changed) {
//                     console.log("No attendance change");
//                     continue;
//                 }
//                 if (lastPunch) {

//                     const diffMs = lastPunch - firstPunch;

//                     const hours = Math.floor(diffMs / 3600000);
//                     const minutes = Math.floor((diffMs % 3600000) / 60000);

//                     durationStr = `${hours}h ${minutes}m`;
//                 }

//                 const status = lastPunch ? "Present" : "Working";

//                 await db.query(
//                     `UPDATE daily_attendance
//                      SET punch_in=$1,
//                          punch_out=$2,
//                          total_hours=$3,
//                          status=$4
//                      WHERE emp_id=$5 AND attendance_date=$6`,
//                     [
//                         formatISTWithOffset(firstPunch),
//                         lastPunch ? formatISTWithOffset(lastPunch) : null,
//                         durationStr,
//                         status,
//                         employee.emp_id,
//                         dayStr
//                     ]
//                 );

//             } else {

//                 firstPunch = punchDate;
//                 lastPunch = null;
//                 emailNeeded = true;

//                 await db.query(
//                     `INSERT INTO daily_attendance
//                      (emp_id,attendance_date,punch_in,punch_out,total_hours,status)
//                      VALUES ($1,$2,$3,$4,$5,$6)`,
//                     [
//                         employee.emp_id,
//                         dayStr,
//                         formatISTWithOffset(firstPunch),
//                         null,
//                         null,
//                         "Working"
//                     ]
//                 );
//             }

//             if (emailNeeded) {

//                 const punchInTimeStr = firstPunch.toLocaleTimeString("en-IN", {
//                     hour: "2-digit",
//                     minute: "2-digit",
//                     hour12: true,
//                     timeZone: "Asia/Kolkata"
//                 });

//                 const punchOutTimeStr = lastPunch
//                     ? lastPunch.toLocaleTimeString("en-IN", {
//                         hour: "2-digit",
//                         minute: "2-digit",
//                         hour12: true,
//                         timeZone: "Asia/Kolkata"
//                     })
//                     : "Initial Punch";

//                 const formattedDate =
//                     `${String(firstPunch.getDate()).padStart(2, "0")}-${String(firstPunch.getMonth() + 1).padStart(2, "0")}-${firstPunch.getFullYear()}`;

//                 const dayName = firstPunch.toLocaleDateString("en-IN", {
//                     weekday: "long",
//                     timeZone: "Asia/Kolkata"
//                 });

//                 try {

//                     await sendEmail(
//                         // employee.email,
//                         "s.imran@i-diligence.com",
//                         "Attendance Notification: Punch",
//                         "punch_in_out",
//                         {
//                             name: employee.name,
//                             emp_id: employee.emp_id,
//                             action: "Punch",
//                             date: formattedDate,
//                             day: dayName,
//                             time: formattedPunch,
//                             punch_in: punchInTimeStr,
//                             punch_out: punchOutTimeStr,
//                             duration: durationStr || "Initial Punch",
//                             is_out: !!lastPunch
//                         }
//                     );

//                     console.log("Email sent:", employee.email);

//                 } catch (err) {
//                     console.error("Email error:", err);
//                 }
//             }
//         }

//         if (newLogs.length) {

//             const finalLastSync = formatISTWithOffset(latestPunch);

//             await db.query(
//                 `INSERT INTO attendance_tracker (device_sn,last_sync)
//                  VALUES ($1,$2)
//                  ON CONFLICT (device_sn)
//                  DO UPDATE SET last_sync=EXCLUDED.last_sync`,
//                 [deviceSN, finalLastSync]
//             );
//         }

//         console.log("[SYNC] Completed");

//         return newLogs;

//     } catch (err) {

//         console.error("[SYNC ERROR]", err);
//         throw err;

//     } finally {

//         try {
//             await zk.disconnect();
//         } catch {
//             console.log("Device disconnect failed");
//         }
//     }
// }

async function getDeviceAttendance() {
  const deviceSN = "EUF7251400009";
  const deviceIP = "60.254.61.177";
  const zk = new ZKLib(deviceIP, 4370, 10000, 4000);

  function formatISTWithOffset(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}+05:30`;
  }

  try {
    console.log("[SYNC] Connecting device...");
    await zk.createSocket();
    await zk.enableDevice();

    const logs = await zk.getAttendances();

    if (!logs?.data?.length) {
      console.log("No logs found");
      return [];
    }

    const { rows: trackerRows } = await db.query(
      `SELECT last_sync FROM attendance_tracker WHERE device_sn=$1`,
      [deviceSN],
    );

    let lastSync = trackerRows[0]?.last_sync || "1970-01-01 00:00:00";
    let lastSyncDate = new Date(lastSync);

    const newLogs = logs.data.filter((log) => {
      const punch = new Date(normalizePunchTime(log.recordTime));
      return punch > lastSyncDate;
    });

    console.log("New Logs:", newLogs.length);

    let latestPunch = lastSyncDate;

    for (const log of newLogs) {
      const punchTimeStr = normalizePunchTime(log.recordTime);
      if (!punchTimeStr) continue;

      const punchDate = new Date(punchTimeStr);
      if (isNaN(punchDate.getTime())) continue;

      const { rows: userRows } = await db.query(
        `SELECT emp_id,name,email FROM users WHERE emp_id=$1`,
        [String(log.deviceUserId)],
      );

      if (!userRows.length) continue;

      const employee = userRows[0];
      const formattedPunch = formatISTWithOffset(punchDate);

      // ---------- attendance_logs ----------
      await db.query(
        `INSERT INTO attendance_logs 
                (emp_id,punch_time,device_ip,device_sn,raw_log)
                VALUES($1,$2,$3,$4,$5)
                ON CONFLICT(emp_id,punch_time) DO NOTHING`,
        [
          employee.emp_id,
          formattedPunch,
          deviceIP,
          deviceSN,
          JSON.stringify(log),
        ],
      );

      // ---------- activity_log ----------
      const insertRes = await db.query(
        `INSERT INTO activity_log
                (emp_id,punch_time,device_ip,device_sn)
                VALUES($1,$2,$3,$4)
                ON CONFLICT(emp_id,punch_time) DO NOTHING`,
        [employee.emp_id, formattedPunch, deviceIP, deviceSN],
      );

      // DUPLICATE PUNCH → skip
      if (insertRes.rowCount === 0) {
        console.log("Duplicate punch ignored");
        continue;
      }

      if (punchDate > latestPunch) latestPunch = punchDate;

      const dayStr = punchDate.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      let durationStr = "Initial Punch";
      let emailNeeded = false;

      const { rows: dailyRow } = await db.query(
        `SELECT * FROM daily_attendance
                 WHERE emp_id=$1 AND attendance_date=$2`,
        [employee.emp_id, dayStr],
      );

      let firstPunch;
      let lastPunch;

      // ---------- UPDATE ----------
      if (dailyRow.length > 0) {
        const existing = dailyRow[0];

        firstPunch = new Date(existing.punch_in);
        lastPunch = existing.punch_out ? new Date(existing.punch_out) : null;

        let needsUpdate = false;

        // Earlier punch
        if (punchDate < firstPunch) {
          firstPunch = punchDate;
          needsUpdate = true;
        }

        // Later punch
        if (!lastPunch || punchDate > lastPunch) {
          lastPunch = punchDate;
          needsUpdate = true;
        }

        if (!needsUpdate) {
          continue;
        }

        const diff = lastPunch - firstPunch;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);

        durationStr = `${hours}h ${minutes}m`;
        emailNeeded = true;

        await db.query(
          `UPDATE daily_attendance
     SET punch_in = $1,
         punch_out = $2,
         total_hours = $3,
         status = 'Present'
     WHERE emp_id = $4
       AND attendance_date = $5`,
          [
            formatISTWithOffset(firstPunch),
            formatISTWithOffset(lastPunch),
            durationStr,
            employee.emp_id,
            dayStr,
          ],
        );
      } else {
        // ---------- FIRST PUNCH ----------
        firstPunch = punchDate;
        lastPunch = null;
        durationStr = "Initial Punch";
        emailNeeded = true;

        await db.query(
          `INSERT INTO daily_attendance
      (emp_id, attendance_date, punch_in, punch_out, total_hours, status)
      VALUES ($1, $2, $3, $4, $5, $6)`,
          [employee.emp_id, dayStr, formattedPunch, null, null, "Working"],
        );
      }

      // ---------- EMAIL ----------
      if (emailNeeded) {
        const punchInTimeStr = firstPunch.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });

        const punchOutTimeStr = lastPunch
          ? lastPunch.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })
          : "Initial Punch";

        const formattedDate = `${String(firstPunch.getDate()).padStart(2, "0")}-${String(firstPunch.getMonth() + 1).padStart(2, "0")}-${firstPunch.getFullYear()}`;

        const dayName = firstPunch.toLocaleDateString("en-IN", {
          weekday: "long",
          timeZone: "Asia/Kolkata",
        });
        console.log("Process.env.NODE_ENV", process.env.NODE_ENV);
        const empEmail =
          process.env.NODE_ENV === "production"
            ? employee.email
            : process.env.LOCAL_ADMIN_EMAILS;

        console.log("empEmail", empEmail);
        const action = lastPunch ? "Punch Out" : "Punch In";

        try {
          await sendEmail(
            empEmail,
            `Attendance Notification: ${action}`,
            "punch_in_out",
            {
              name: employee.name,
              emp_id: employee.emp_id,
              action: action,
              date: formattedDate,
              day: dayName,
              time: formattedPunch,
              punch_in: punchInTimeStr,
              punch_out: punchOutTimeStr,
              duration: durationStr,
            },
          );

          console.log("Email sent:", employee.email);
        } catch (err) {
          console.error("Email error:", err);
        }
      }
    }

    // ---------- UPDATE SYNC ----------
    if (newLogs.length) {
      const finalSync = formatISTWithOffset(latestPunch);

      await db.query(
        `INSERT INTO attendance_tracker(device_sn,last_sync)
                 VALUES($1,$2)
                 ON CONFLICT(device_sn)
                 DO UPDATE SET last_sync=EXCLUDED.last_sync`,
        [deviceSN, finalSync],
      );
    }

    console.log("SYNC COMPLETED");

    return newLogs;
  } catch (err) {
    console.error("SYNC ERROR:", err);
    throw err;
  } finally {
    try {
      await zk.disconnect();
    } catch {
      console.log("Device disconnect error");
    }
  }
}
let isSyncRunning = false;

cron.schedule("*/1 * * * *", async () => {
  if (isSyncRunning) {
    console.log("Previous sync still running");
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
// let isSyncRunning2 = false;
// cron.schedule("*/1 * * * *", async () => {
//     if (isSyncRunning2) {
//         console.warn("[CRON] Previous sync still running, skipping");
//         return;
//     }
//     isSyncRunning2 = true;
//     try {
//         await getDeviceAttendance();

//     } finally {
//         isSyncRunning2 = false;
//     }
// });

module.exports = { getDeviceAttendance };
