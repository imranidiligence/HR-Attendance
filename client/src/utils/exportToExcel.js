// utils/exportToExcel.js
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* Format date/time in Asia/Kolkata */
const formatIST = (value, type = "date") => {
  if (!value) return "--";
  const date = new Date(value);

  if (type === "date") {
    return date.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }); // DD/MM/YYYY
  } else if (type === "time") {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }); // HH:MM
  }

  return date.toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });
};

/* Format total working hours if object {hours, minutes} */
const formatInterval = (val) => {
  if (!val) return "--";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const h = String(val.hours || 0).padStart(2, "0");
    const m = String(val.minutes || 0).padStart(2, "0");
    return `${h}:${m}`;
  }
  return "--";
};
// Get weekday based on attendance_date in IST
const getWeekDayIST = (dateStr) => {
    if (!dateStr) return "--";
  
    // Convert to Date object
    const date = new Date(dateStr);
  
    //  Asia/Kolkata timezone
    const weekday = date.toLocaleDateString("en-GB", {
      weekday: "short", // Mon, Tue, Wed
      timeZone: "Asia/Kolkata",
    });
  
    return weekday;
  };
  
export const exportToExcel = (data, fileName = "Attendance_Report") => {
  if (!data || !data.length) return;


//   console.log(data);
  // Map data for Excel
  const excelData = data.map((row, index) => ({
    "Sr No": index + 1,
    "Day":getWeekDayIST(row.attendance_date),
    "Employee ID": row.emp_id || "--",
    "Employee Name": row.employee_name|| "--",
    "Date (IST)": formatIST(row.attendance_date, "date"),
    "Punch In (IST)": row.punch_in ? formatIST(row.punch_in, "time") : "--",
    "Punch Out (IST)": row.punch_out ? formatIST(row.punch_out, "time") : "--",
    "Total Working Hours": row.total_hours ? formatInterval(row.total_hours) : "--",
    "Status": row.status || "--",
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });

  saveAs(blob, `${fileName}.xlsx`);
};
