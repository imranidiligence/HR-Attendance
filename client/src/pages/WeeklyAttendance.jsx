import { Typography } from "@mui/material";
import React, { useContext, useEffect, useMemo } from "react";
import Filters from "../components/Filters";
import Loader from "../components/Loader";
import { EmployContext } from "../context/EmployContextProvider";


const StatusBadge = ({ status }) => {
  const styles = {
    "Present": "bg-green-600 text-white",
    "Working": "bg-blue-600 text-white",
    "Absent": "bg-red-600 text-white",
    "Late Come": "bg-orange-500 text-white",
    "Early Go": "bg-yellow-400 text-white", // optional
  };

  const className = `inline-block w-24 text-center font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
    styles[status] || "bg-gray-400 text-white"
  }`;

  return <span className={className}>{status}</span>;
};

const WeeklyAttendance = () => {
  const { holidays, filters, formatDate, weeklyData, weeklyLoading } = useContext(EmployContext);



  const employees = weeklyData?.data || [];
  // const searchTerm = (filters.weekSearch || "").toLowerCase().trim();
  const date = new Date();
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

 
  const flattenedData = useMemo(() => {
  if (!employees || employees.length === 0) return [];

  return employees.flatMap((day) =>
    (day.employees || []).map((emp) => ({
      ...emp,
      date: day.date
    }))
  );
}, [employees]);
  const filteredEmployees = useMemo(() => {
  const rawSearch = (filters.weekSearch || "").toLowerCase().trim();

  if (!rawSearch) {
    return flattenedData.filter((emp) => emp.emp_id !== "2020");
  }

  const isTimeSearch = rawSearch.includes(":");
  const cleanSearch = rawSearch.replace(/[^\d:]/g, "");

  const getCleanTime = (timeStr) => {
    if (!timeStr) return "";
    return timeStr.replace(/[^\d:]/g, "");
  };

  return flattenedData.filter((row) => {
    if (row.emp_id === "2020") return false;

    const firstIn = getCleanTime(row.first_in);
    const lastOut = getCleanTime(row.last_out);

    if (isTimeSearch) {
      return (
        firstIn.includes(cleanSearch) ||
        lastOut.includes(cleanSearch)
      );
    }

    return (
      row.name?.toLowerCase().includes(rawSearch) ||
      row.emp_id?.toString().includes(rawSearch) ||
      row.first_in?.toLowerCase().includes(rawSearch) ||
      row.last_out?.toLowerCase().includes(rawSearch)
    );
  });
}, [flattenedData, filters.weekSearch]);

  useEffect(() => {
    // console.log("filteredEmployees Weekly", filteredEmployees);

  }, [filters, filteredEmployees]);
  // Helper functions
  const getDayName = (dateStr) => !dateStr ? "" : new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });

  const getHolidayMatch = (dateStr) => {
    if (!dateStr || !holidays?.length) return null;
    const aDate = new Date(dateStr).toDateString();
    return holidays.find((h) => new Date(h.holiday_date).toDateString() === aDate);
  };

  const getDayIndexMondayFirst = (date) => {
    const day = new Date(date).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const formatHours = (hours) => {
    if (!hours) return "--";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, "0")}`;
  };

  useEffect(()=>{

    // console.log("filteredEmployees",filteredEmployees)
  },[filteredEmployees])
  const headers = ["Sr No", "Day", "Emp ID", "Employee", "Date", "Status", "Punch In", "Punch Out", "Working Hours", "Expected Hours"];

  return (
    <div className="min-h-max px-3 bg-gray-50">
      <div className="sticky z-20 top-0 bg-[#222F7D] rounded-xl py-2 mb-1 shadow-lg flex justify-between items-center px-6 mt-[9px]">
        <div className="w-8 text-nowrap text-white justify-start">{`Date: ${day}-${month}-${year} `}</div>
        <Typography className="text-white font-bold" sx={{ fontSize: "1rem" }}>
          Weekly Attendance
        </Typography>
        <div className=""></div>
      </div>

      <Filters />

      <div className="relative overflow-auto w-full border border-gray-300 rounded max-h-[800px] bg-white shadow-sm">
        <table className={`min-w-full text-sm border-collapse ${weeklyLoading ? "opacity-50" : "opacity-100"}`}>
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border-b px-4 py-3 font-bold text-left text-gray-700 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
  {filteredEmployees.length > 0 ? (
    filteredEmployees.map((row, index) => {
      const dayStr = getDayName(row.date);
      const holidayMatch = getHolidayMatch(row.date);
      const isSunday = dayStr === "Sunday";
      const isSaturday = dayStr === "Saturday";
      const expectedHours = isSaturday ? 5 : 9.3;

      return (
        <tr
          key={`${row.emp_id}-${row.date}`}
          className={`transition-colors ${
            isSunday ? "bg-orange-100" : holidayMatch ? "bg-blue-50" : ""
          }`}
        >
          <td className="px-4 py-2 font-bold">{index + 1}</td>
          <td className="px-4 py-2 font-bold text-[11px]">{dayStr}</td>
          <td className="px-4 py-2 font-bold">{row.emp_id}</td>
          <td className="px-4 py-2">{row.name}</td>
          <td className="px-4 py-2">{formatDate(row.date)}</td>

          <td className="px-4 py-2">
           {holidayMatch ? (
                          <span className="inline-block text-center font-bold text-blue-700 w-24 h-6 bg-blue-100 px-2 py-0.5 rounded text-[10px] uppercase border border-blue-200">
                            {holidayMatch.holiday_name}
                          </span>
                        )  :isSunday ? (
                          <span className="inline-block w-24 text-center text-white font-bold bg-orange-600 px-2 py-0.5 rounded text-[10px] uppercase">
                            Week Off
                          </span>
                        ) : (
              <StatusBadge status={row.status} />
            )}
          </td>

          <td className="px-4 py-2">
            {holidayMatch || isSunday ? "--" : row.first_in || "--"}
          </td>

          <td className="px-4 py-2">
            {holidayMatch || isSunday ? "--" : row.last_out || "--"}
          </td>

          <td className="px-4 py-2">
            {holidayMatch || isSunday ? "--" : formatHours(row.total_hours)}
          </td>

          <td className="px-4 py-2">
            {holidayMatch || isSunday ? "--" : expectedHours}
          </td>
        </tr>
      );
    })
  ) : (
    <tr>
      <td colSpan={10} className="py-20 text-center">
        {weeklyLoading ? <Loader /> : "No attendance records found"}
      </td>
    </tr>
  )}
</tbody>
        </table>
      </div>
    </div>
  );
};

export default WeeklyAttendance;