import { useState, useContext, useEffect, useMemo } from "react";
import { HiMiniAdjustmentsHorizontal } from "react-icons/hi2";
import { ImCancelCircle } from "react-icons/im";
import { CiStar } from "react-icons/ci";
import {
  FaLongArrowAltRight,
  FaLongArrowAltLeft,
  FaRegCheckCircle,
  FaRegCalendarAlt,
  FaFileExcel,
} from "react-icons/fa";
import { MdDriveEta, MdOutlineAccessTime } from "react-icons/md";
import { BiSolidFilePdf } from "react-icons/bi";

import { EmployContext } from "../context/EmployContextProvider";
import api from "../../api/axiosInstance";
import { exportMonthlyMatrixAttendance } from "../utils/monthlyToExcel";
import axios from "axios";
import Pagination from "../components/Pagination"; // Import Pagination component

export default function MonthlyAttendance() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [employees, setEmployees] = useState([]);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 10;

  const { holidays } = useContext(EmployContext);

  const holidayDates = useMemo(() => {
    return holidays.map((h) => h.holiday_date);
  }, [holidays]);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const departments = [
    "All",
    "Marketing",
    "Sales",
    "Engineering",
    "HR",
    "Finance",
    "IT",
  ];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Navigation handlers
  const next = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
    setPage(1); // Reset to page 1 when month changes
  };

  const previous = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
    setPage(1); // Reset to page 1 when month changes
  };

  const previousYear = () => {
    setSelectedYear(selectedYear - 1);
    setPage(1); // Reset to page 1 when year changes
  };
  
  const nextYear = () => {
    setSelectedYear(selectedYear + 1);
    setPage(1); // Reset to page 1 when year changes
  };

  // Fetch attendance data
  useEffect(() => {
    const fetchAllAttendance = async () => {
      try {
        // Use applied filters for fetching or current selection
        const monthToFetch = filtersApplied ? appliedFilters.month + 1 : selectedMonth + 1;
        const yearToFetch = filtersApplied ? appliedFilters.year : selectedYear;
        
        const resp = await api.get("/admin/attendance/all-attendance", {
          params: { month: monthToFetch, year: yearToFetch },
        });
        setEmployees(resp.data.attendance || []);
        setPage(1); // Reset to page 1 when data changes
      } catch (err) {
        console.error(err);
      }
    };
    fetchAllAttendance();
  }, [filtersApplied ? appliedFilters.month : selectedMonth, 
      filtersApplied ? appliedFilters.year : selectedYear]);

  // Filter employees by department - using applied filters
  const filteredEmployees = useMemo(() => {
    const filtered = selectedDepartment === "All"
      ? employees
      : employees.filter(emp => emp.department === selectedDepartment);
    
    // Filter out inactive employees and emp_id 2020
    return filtered.filter(emp => emp.is_active === true && emp.emp_id !== "2020");
  }, [employees, selectedDepartment]);

  // Reset to page 1 when department filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedDepartment]);

  // Calculate pagination
  const totalRecords = filteredEmployees.length;
  const totalPages = Math.ceil(totalRecords / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  const exportMonthlyAttendance = (data) => {
    const targetMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    exportMonthlyMatrixAttendance(data, targetMonthStr);
  };

  const formatTime = (dateString) => {
    if (!dateString) return "--";

    const date = new Date(dateString);

    // handle invalid date
    if (isNaN(date.getTime())) return "--";

    return date
      .toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      })
      .replace("AM", "am")
      .replace("PM", "pm");
  };

  // Attendance status icons
  const getStatusIcon = (dayData) => {
    const punchIn = dayData?.first_in || "--";
    const punchout = dayData?.last_out || "--";
    const totalhrs = dayData?.hours_worked || "--";

    switch ((dayData?.status || "")) {
      case "Present":
      case "Working":
        return <FaRegCheckCircle
          className="text-green-500 inline text-lg"
          title={`Punch In: (${formatTime(punchIn)})
Punch Out: (${punchout ? formatTime(punchout) : "--"})
Total Hours: (${totalhrs ?? "--"})`}
        />
      case "Absent": 
        return <ImCancelCircle className="text-red-500 inline text-lg" title="Absent" />;
      case "Late Come":
      case "Early Go":
        return (
          <MdOutlineAccessTime
            size={22}
            className="text-orange-500 inline"
            title={`(Late/Early) Punch In: (${formatTime(punchIn)})
Punch Out: (${punchout ? formatTime(punchout) : "--"})
Total Hours: (${totalhrs ?? "--"})`}
          />
        );
      case "Holiday": 
        return <CiStar size={22} className="text-yellow-500 inline" title="Holiday" />;
      case "leave": 
        return <FaRegCalendarAlt className="text-orange-500 inline text-lg" title="Leave" />;
      case "ondrive": 
        return <MdDriveEta size={18} className="text-blue-500 inline" title="OD" />;
      case "Punch Miss":
        return <FaRegCheckCircle className="text-red-500 text-lg"
          title={`Punch In: (${formatTime(punchIn)})
Punch Out: (${punchout ? formatTime(punchout) : "--"})
Total Hours: (${totalhrs ?? "--"})`}
        />
      default: return "-";
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const today = new Date();
  const date = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-gray-100 min-h-screen rounded-2xl shadow-[0_0_25px_rgba(0,0,0,0.15)]">
        {/* Header */}
        <div className="p-4 px-6 bg-white rounded-2xl lg:flex justify-between items-center shadow-sm mb-4">
          <div className="space-y-2">
            <h2 className="text-base lg:text-2xl font-bold tracking-tight text-gray-900">
              All Employee Attendance
            </h2>
            <div className="flex lg:flex-wrap items-center gap-1 text-xs text-gray-500">
              <span className="px-1 py-0.5 rounded-full text-gray-600 font-medium">
                HR
              </span>
              <span className="text-gray-300">/</span>
              <span className="hover:text-gray-700 cursor-pointer transition">
                Employee Attendance
              </span>
              <span className="text-gray-300">/</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                Monthly Overview
              </span>
            </div>
          </div>

          <div className=" border-gray-100 ">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-6">
              {/* Department Selector */}
              <div className="flex-1 w-full lg:w-auto">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full lg:w-48 appearance-none bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all cursor-pointer hover:border-purple-300"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month & Year Combined */}
              <div className="flex-1 w-full lg:w-auto">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Period
                </label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1.5">
                  <button
                    onClick={previous}
                    className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"
                  >
                    <FaLongArrowAltLeft size={12} className="text-gray-500" />
                  </button>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer px-1"
                  >
                    {months.map((month, index) => (
                      <option key={index} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-300">|</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-medium text-gray-700 focus:outline-none cursor-pointer px-1"
                  >
                    {[2023, 2024, 2025, 2026].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={next}
                    className="p-1.5 rounded hover:bg-white hover:shadow-sm transition-all"
                  >
                    <FaLongArrowAltRight size={12} className="text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Quick Actions / Filters */}
              <div className="flex-1 w-full pt-5 lg:w-auto flex items-end justify-end gap-3">
                {/* Apply Filters Button */}
                <button 
                  onClick={applyFilters}
                  className="w-full lg:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  
                </button>

                {/* Refresh Filters Button */}
                <button 
                  onClick={refreshFilters}
                  className={`w-full lg:w-auto px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
                    isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={isRefreshing}
                >
                  <svg 
                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Bar - Keep this section unchanged */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="items-center justify-between">
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 sm:p-5 border border-gray-200">
                {/* Keep all the status indicators and export button as is */}
                <div className="flex items-center gap-2 bg-gradient-to-br from-blue-50 to-indigo-50/50 px-4 py-2 rounded-xl border border-blue-200 shadow-sm justify-center">
                  <FaRegCalendarAlt className="text-blue-500 text-lg" />
                  <div className="flex items-baseline gap-1.5 ">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Today
                    </span>
                    <span className="text-sm font-semibold text-gray-800 bg-white px-2 py-0.5 rounded-lg border border-blue-100">
                      {date}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-center lg:justify-start max-w-full ">
                  {/* Status indicators */}
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 shadow-sm ">
                    <FaRegCheckCircle className="text-green-500" />{" "}
                    <span className="text-xs font-medium text-gray-700">
                      Present
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 shadow-sm ">
                    <FaRegCheckCircle className="text-red-500" /> <span className="text-xs font-medium text-gray-700">Punch Miss</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 shadow-sm">
                    <ImCancelCircle className="text-red-500" />{" "}
                    <span className="text-xs font-medium text-gray-700">
                      Absent
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 shadow-sm">
                    <CiStar className="text-purple-500" />{" "}
                    <span className="text-xs font-medium text-gray-700">
                      Holiday
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 shadow-sm">
                    <FaRegCalendarAlt className="text-orange-500" />{" "}
                    <span className="text-xs font-medium text-gray-700">
                      Leave
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 border border-yellow-200 shadow-sm">
                    <MdOutlineAccessTime className="text-yellow-500" />{" "}
                    <span className="text-xs font-medium text-gray-700">
                      Late/EarlyGo
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 shadow-sm">
                    <MdDriveEta className="text-blue-500" />{" "}
                    <span className="text-xs font-medium text-gray-700">
                      OD
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-center lg:justify-end gap-3">
                  <button className="group relative flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200 hover:border-green-300 transition-all" onClick={() => exportMonthlyAttendance(filteredEmployees)}>
                    <FaFileExcel size={18} className="text-green-600" />
                    <span className="text-xs font-medium text-gray-700 hidden sm:inline">
                      Excel
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table - Keep this section unchanged */}
          <div className="overflow-x-auto m-2 sm:m-4 rounded-xl border border-gray-200">
            <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-max border-separate border-spacing-0">
              <thead className="bg-blue-100 text-gray-800">
                <tr>
                  <th className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 font-semibold sticky left-0 bg-blue-100 z-20 min-w-[200px] sm:min-w-[240px]">
                    EMPLOYEE
                  </th>
                  {monthDays.map((day) => {
                    const weekDay = weekDays[new Date(selectedYear, selectedMonth, day).getDay()];
                    const isSunday = weekDay === "SUN";
                    return (
                      <th
                        key={day}
                        className={`border border-gray-300 px-2 py-2 text-center ${isSunday ? "bg-orange-300" : ""}`}
                      >
                        <div className="text-xs text-gray-800">{day}</div>
                        <div className="text-xs text-gray-600">{weekDay}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {paginatedEmployees.map((emp) => (
                  <tr key={emp.emp_id} className="hover:bg-gray-50 transition">
                    <td className="border border-gray-200 px-2 sm:px-4 py-2 sm:py-3 font-semibold sticky left-0 bg-white z-10 min-w-[200px] sm:min-w-[240px]">
                      <div className="flex items-center gap-2">
                        <div className="leading-tight">
                          <span className="block text-xs sm:text-sm truncate max-w-[120px]">
                            {emp.name}
                          </span>
                          <div className="text-[10px] text-gray-400 truncate max-w-[120px]">
                            {emp.department}
                          </div>
                        </div>
                      </div>
                    </td>

                    {monthDays.map((day) => {
                      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                      const today = new Date();
                      const currentDate = new Date(
                        today.getFullYear(),
                        today.getMonth(),
                        today.getDate()
                      );

                      const cellDate = new Date(selectedYear, selectedMonth, day);
                      const isFutureDate = currentDate < cellDate;
                      const isHoliday = holidayDates.includes(dateStr);
                      const dayData = emp.attendance?.find((a) => a.date === dateStr);
                      const weekDayIndex = new Date(selectedYear, selectedMonth, day).getDay();
                      const isSunday = weekDayIndex === 0;

                      return (
                        <td
                          key={`${emp.emp_id}-${day}`}
                          className={`border border-gray-200 px-2 sm:px-4 py-2 text-center
                            ${isSunday ? "bg-orange-50 text-orange-600 font-semibold" : ""}`}
                        >
                          {isFutureDate ? ("--") : isHoliday ? (
                            <span title="Public Holiday">🎉</span>
                          ) : isSunday ? (
                            "--"
                          ) : (
                            getStatusIcon(dayData)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {paginatedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={monthDays.length + 1} className="text-center py-10 text-gray-500">
                      No employees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalRecords > 0 && (
            <div className="mt-4 pb-4">
              <Pagination
                totalPages={totalPages}
                page={page}
                onChange={handlePageChange}
                totalRecords={totalRecords}
                limit={limit}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}