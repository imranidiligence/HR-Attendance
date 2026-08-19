import React, { useContext, useMemo } from "react";
import { EmployContext } from "../context/EmployContextProvider";
import Loader from "./Loader";
import { useLocation } from "react-router-dom";

const StatusBadge = ({ status }) => {
  const styles = {
    "Present": "bg-green-600 text-white",
    "Working": "bg-blue-600 text-white",
    "Late Come": "bg-orange-500 text-white",
    "Early Go": "bg-yellow-400 text-white", 
    "Absent": "bg-red-600 text-white",
    "Half Day": "bg-orange-500 text-white",
  };

  return (
    <span
      className={`inline-block px-2 py-1 w-20 text-center rounded text-[12px] uppercase font-semibold ${
        styles[status] || "bg-gray-300 text-gray-800"
      }`}
    >
      {status}
    </span>
  );
};

const formatTime = (value) => {
  if (!value) return "--";
  if (typeof value === "string" && (value.includes("AM") || value.includes("PM")))
    return value;
  try {
    const d = new Date(value);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return value;
  }
};

const formatInterval = (val) => {
  if (!val) return "--";
  if (typeof val === "object") {
    const h = String(val.hours || 0).padStart(2, "0");
    const m = String(val.minutes || 0).padStart(2, "0");
    return `${h}:${m}`;
  }
  return val;
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleDateString("en-GB");
};

const Table = ({ 
  attendanceData = [], 
  loading = false, 
  isAdminView = false,
  pagination = null,
  showSrNo = false
}) => {
  const { filters, holidays } = useContext(EmployContext);
  const location = useLocation();
  
  const isEmployee = location.pathname.startsWith("/employee");
  const isEmployAttendance = location.pathname.startsWith("/admin/my-dashboard/attendance");

  const getHolidayMatch = (attendanceDate, holidaysList = []) => {
    if (!attendanceDate || !holidaysList.length) return null;
    const aDate = new Date(attendanceDate).toDateString();
    return holidaysList.find((h) => new Date(h.holiday_date).toDateString() === aDate);
  };

  const getRowClass = (dayStr, isToday, isHoliday, index) => {
    if (isHoliday) return "bg-blue-50 text-blue-900 font-medium";
    if (dayStr === "Sunday" && (isEmployee || isEmployAttendance)) 
      return "bg-[#faa307] text-white font-semibold";
    if (dayStr === "Saturday" && (isEmployee || isEmployAttendance))
      return "bg-[#D1FFBD] text-dark font-semibold";
    if (isToday) return "bg-white font-semibold";
    return index % 2 === 0 ? "bg-white" : "bg-gray-50";
  };

  // Filter data based on filters
  const filteredData = useMemo(() => {
    let result = [...attendanceData];

    if (filters?.startDate) {
      const start = new Date(filters.startDate).setHours(0, 0, 0, 0);
      result = result.filter((row) => new Date(row.attendance_date).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate).setHours(23, 59, 59, 999);
      result = result.filter((row) => new Date(row.attendance_date).getTime() <= end);
    }
    if (filters?.attendanceSearch) {
      const search = filters.attendanceSearch.toLowerCase();
      result = result.filter((row) => {
        const name = (row.name || row.employee_name || "").toLowerCase();
        const empId = String(row.emp_id || "");
        return name.includes(search) || empId.includes(search);
      });
    }

    return result;
  }, [attendanceData, filters]);

  // Determine headers based on view
  const headers = isAdminView && !isEmployAttendance
    ? ["Sr No", "Day", "Emp ID", "Employee", "Date", "Status", "Punch In", "Punch Out", "Working Hours", "Expected Hours"]
    : ["Day", "Emp ID", "Date", "Status", "Punch In", "Punch Out", "Working Hours", "Expected Hours"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader />
      </div>
    );
  }

  if (!filteredData.length) {
    return (
      <div className="flex items-center justify-center h-[70vh] text-gray-500">
        No attendance data found
      </div>
    );
  }

  return (
    <div className="max-h-[800px] w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm border-collapse">
        <thead className="bg-gray-100 sticky top-0 left-0 z-8">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b px-4 py-3 font-semibold text-left text-gray-700 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {filteredData
            .filter((row) => row.emp_id && row.emp_id !== "2020")
            .map((row, i) => {
              const dateObj = new Date(row.attendance_date);
              const dayIndex = dateObj.getDay();
              const isSunday = dayIndex === 0;
              const isSaturday = dayIndex === 6;
              const dayStr = dateObj.toLocaleDateString("en-IN", { weekday: "long" });
              const holidayMatch = getHolidayMatch(row.attendance_date, holidays);

              const today = new Date();
              const isToday =
                today.getFullYear() === dateObj.getFullYear() &&
                today.getMonth() === dateObj.getMonth() &&
                today.getDate() === dateObj.getDate();

              const isAbsent = row.status === "Absent" && !holidayMatch && !isSunday;
              const displayName = row.employee_name || row.name || "--";

              // Calculate Sr No based on pagination if provided
              const srNo = pagination 
                ? (pagination.currentPage - 1) * pagination.limit + i + 1
                : i + 1;

              return (
                <tr 
                  key={row.emp_id ? `${row.emp_id}-${i}` : i} 
                  className={`${getRowClass(dayStr, isToday, !!holidayMatch, i)} transition-colors`}
                >
                  {isAdminView && !isEmployAttendance ? (
                    <>
                      <td className="border-b px-4 py-2 text-gray-600">{srNo}</td>
                      <td className="border-b px-4 py-2 font-semibold">{dayStr}</td>
                      <td className="border-b px-4 py-2 font-medium text-gray-800 whitespace-nowrap">{row.emp_id || "--"}</td>
                      <td className="border-b px-4 py-2 whitespace-nowrap">{displayName}</td>
                      <td className="border-b px-4 py-2 whitespace-nowrap">{formatDate(row.attendance_date)}</td>
                      <td className="border-b px-4 py-2">
                        {holidayMatch ? (
                          <span className="inline-block text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded border border-blue-200 text-[10px] uppercase">
                            {holidayMatch.holiday_name}
                          </span>
                        ) : isSunday ? (
                          <span className="inline-block w-24 text-center text-white font-bold bg-orange-600 px-2 py-0.5 rounded text-[10px] uppercase">
                            Week Off
                          </span>
                        ) : (
                          <StatusBadge status={row.status} />
                        )}
                      </td>
                      <td className="border-b px-4 py-2">
                        {isAbsent || holidayMatch || isSunday ? "--" : formatTime(row.punch_in)}
                      </td>
                      <td className="border-b px-4 py-2">
                        {isAbsent || holidayMatch || isSunday ? "--" : 
                          row.punch_out ? formatTime(row.punch_out) : 
                          <span className="text-orange-500">Working...</span>
                        }
                      </td>
                      <td className="border-b px-4 py-2">
                        {isAbsent || holidayMatch || isSunday ? "--" : formatInterval(row.total_hours)}
                      </td>
                      <td className="border-b px-4 py-2">
                        {holidayMatch || isSunday ? "0" : isSaturday ? "5" : "9.3"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`border-b px-4 py-2 font-semibold ${isSunday ? "text-white" : "text-gray-600"}`}>
                        {dayStr}
                      </td>
                      <td className="border-b px-4 py-2 whitespace-nowrap">{row.emp_id}</td>
                      <td className="border-b px-4 py-2 whitespace-nowrap">{formatDate(row.attendance_date)}</td>
                      <td className="border-b px-4 py-2">
                        {holidayMatch ? (
                          <span className="inline-block text-center font-bold text-blue-700 w-20 h-6 bg-blue-100 px-2 py-0.5 rounded text-[10px] uppercase border border-blue-200">
                            {holidayMatch.holiday_name}
                          </span>
                        ) : isSunday ? (
                          <span className="text-white font-bold">Week Off</span>
                        ) : (
                          <StatusBadge status={row.status} />
                        )}
                      </td>
                      <td className="border-b px-4 py-2">
                        {isAbsent || holidayMatch || isSunday ? "--" : formatTime(row.punch_in)}
                      </td>
                      <td className="border-b px-4 py-2">
                        {isAbsent || holidayMatch || isSunday ? "--" : 
                          row.punch_out ? formatTime(row.punch_out) : "Working..."
                        }
                      </td>
                      <td className="border-b px-4 py-2">
                        {isAbsent || holidayMatch || isSunday ? "--" : formatInterval(row.total_hours)}
                      </td>
                      <td className="border-b px-4 py-2">
                        {holidayMatch || isSunday ? "--" : isSaturday ? "5" : "9.3"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default Table;