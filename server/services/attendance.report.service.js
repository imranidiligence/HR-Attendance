const sendEmail = require("../utils/mailer");

const REPORT_RECIPIENTS = (process.env.ATTENDANCE_REPORT_RECIPIENTS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTime(ts) {
  if (!ts) return "--";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function formatDate(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/*
  pg returns INTERVAL columns as an object like
  { hours: 8, minutes: 15 } by default (node-postgres).
  Adjust here if your driver/parsing config differs.
*/
function formatDuration(interval) {
  if (!interval) return "0h 0m";
  if (typeof interval === "string") return interval;
  const hours = interval.hours || 0;
  const minutes = interval.minutes || 0;
  return `${hours}h ${minutes}m`;
}

function statusColor(statusName) {
  const colors = {
    present: "#16a34a",
    working: "#2563eb",
    "half day": "#d97706",
    absent: "#dc2626",
    holiday: "#7c3aed",
  };
  return colors[(statusName || "").toLowerCase()] || "#6b7280";
}

function buildEmployeeRowsHtml(rows) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="7" style="padding: 16px; border: 1px solid #dee2e6; text-align: center; color: #6b7280;">
          No attendance records for this date yet.
        </td>
      </tr>`;
  }

  return rows
    .map((r, idx) => {
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const color = statusColor(r.status_name);

      return `
      <tr style="background:${bg};">
        <td style="padding: 10px; border: 1px solid #dee2e6; white-space: nowrap;">${escapeHtml(r.emp_id)}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; white-space: nowrap;">${escapeHtml(r.emp_name || "-")}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; white-space: nowrap;">${formatDate(r.attendance_date)}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; white-space: nowrap;">${formatTime(r.punch_in)}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; white-space: nowrap;">${formatTime(r.punch_out)}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; white-space: nowrap;">${formatDuration(r.total_hours)}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; white-space: nowrap;">
          <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;color:#fff;background:${color};">
            ${escapeHtml(r.status_name || "Unknown")}
          </span>
        </td>
      </tr>`;
    })
    .join("");
}

async function fetchTodayAttendanceRows(client) {
  const result = await client.query(`
   SELECT
  da.emp_id,

  TRIM(
    CONCAT_WS(' ', p.pr_first_name, p.pr_last_name)
  ) AS emp_name,

  da.attendance_date,
  da.punch_in,
  da.punch_out,
  da.total_hours,
  st.status_name

FROM public.daily_attendance da

LEFT JOIN public.organizations o
  ON TRIM(o.or_emp_id) = da.emp_id

LEFT JOIN public.personal p
  ON p.pr_id = o.pr_id

LEFT JOIN public.attendence_status st
  ON st.id = da.status_id

WHERE da.attendance_date =
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE

ORDER BY da.emp_id
  `);

  return result.rows;
}

async function sendReport(client, reportLabel) {
  if (REPORT_RECIPIENTS.length === 0) {
    console.warn(
      "[REPORT] No recipients configured in ATTENDANCE_REPORT_RECIPIENTS — skipping send"
    );
    return { sent: false, reason: "no_recipients", rows: 0 };
  }

  const rows = await fetchTodayAttendanceRows(client);

  const now = new Date();

  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const employeeRowsHtml = buildEmployeeRowsHtml(rows);

  await sendEmail(
    REPORT_RECIPIENTS.join(","),
    `Attendance Report — ${reportLabel} (${dateStr})`,
    "attendance_report",
    {
      date: dateStr,
      time: timeStr,
      employee_rows: employeeRowsHtml,
    }
  );

  console.log(
    `[REPORT] ${reportLabel} sent to ${REPORT_RECIPIENTS.length} recipient(s), ${rows.length} rows`
  );

  return { sent: true, rows: rows.length, recipients: REPORT_RECIPIENTS.length };
}

async function sendMorningAttendanceReport(client) {
  return sendReport(client, "Morning Update");
}

async function sendEveningAttendanceReport(client) {
  return sendReport(client, "End of Day Summary");
}

module.exports = {
  sendMorningAttendanceReport,
  sendEveningAttendanceReport,
};