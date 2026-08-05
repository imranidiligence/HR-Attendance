
import { useState, useContext, useEffect, useMemo } from "react";
import { HiMiniAdjustmentsHorizontal } from "react-icons/hi2";
import { ImCancelCircle } from "react-icons/im";
import { CiStar } from "react-icons/ci";
import { FaLongArrowAltRight, FaLongArrowAltLeft, FaRegCheckCircle, FaRegCalendarAlt, FaFileExcel } from "react-icons/fa";
import { MdDriveEta, MdOutlineAccessTime } from "react-icons/md";
import { BiSolidFilePdf } from "react-icons/bi";

import { EmployContext } from "../context/EmployContextProvider";
import api from "../../api/axiosInstance";
import { exportMonthlyMatrixAttendance } from "../utils/monthlyToExcel";
import axios from "axios";

export default function MonthlyAttendance() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [employees, setEmployees] = useState([]);

  const { holidays } = useContext(EmployContext);


  const holidayDates = useMemo(() => {
    return holidays.map(h => h.holiday_date);
  }, [holidays]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const departments = ["All", "Marketing", "Sales", "Engineering", "HR", "Finance"];

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
  };

  const previous = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const previousYear = () => setSelectedYear(selectedYear - 1);
  const nextYear = () => setSelectedYear(selectedYear + 1);

  // Fetch attendance data
  useEffect(() => {
    const fetchAllAttendance = async () => {
      try {
        const resp = await api.get("/admin/attendance/all-attendance", {
          params: { month: selectedMonth + 1, year: selectedYear },
        });
        setEmployees(resp.data.attendance || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAllAttendance();
  }, [selectedMonth, selectedYear]);

  // Filter employees by department
  const filteredEmployees = useMemo(() => {
    return selectedDepartment === "All"
      ? employees
      : employees.filter(emp => emp.department === selectedDepartment);
  }, [employees, selectedDepartment]);

  // useEffect(() => {
  //   console.log("employees", employees);
  // }, [employees])

  const exportMonthlyAttendance = (data) => {
    const targetMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    exportMonthlyMatrixAttendance(data, targetMonthStr)
  }

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

    // console.log("dayData",dayData);
    const punchIn = dayData?.first_in || "--";
    const punchout = dayData?.last_out || "--";
    const totalhrs = dayData?.hours_worked || "--";

    // console.log("punchIn",punchIn);
    // console.log("punchout",punchout);
    switch ((dayData?.status || "")) {
    case "Present":
    case "Working":
    return <FaRegCheckCircle
      className="text-green-500 inline text-lg"
      title={`Punch In: (${formatTime(punchIn)})
Punch Out: (${punchout ? formatTime(punchout) : "--"})
Total Hours: (${totalhrs ?? "--"})`}
    />
      case "Absent": return <ImCancelCircle className="text-red-500 inline text-lg" title="Absent" />;
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
      case "Holiday": return <CiStar size={22} className="text-yellow-500 inline" title="Holiday" />;
      case "leave": return <FaRegCalendarAlt className="text-orange-500 inline text-lg" title="Leave" />;
      case "ondrive": return <MdDriveEta size={18} className="text-blue-500 inline" title="OD" />;
      
      case "Punch Miss":return<FaRegCheckCircle className="text-red-500 text-lg"
        title={`Punch In: (${formatTime(punchIn)})
Punch Out: (${punchout ? formatTime(punchout) : "--"})
Total Hours: (${totalhrs ?? "--"})`}
      /> 
              
      

      // <MdOutlineAccessTime className="text-yellow-500" />
      default: return "-";
    }
  };

  const today = new Date();
  const date = today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
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
              <span className="px-1 py-0.5 rounded-full text-gray-600 font-medium">HR</span>
              <span className="text-gray-300">/</span>
              <span className="hover:text-gray-700 cursor-pointer transition">Employee Attendance</span>
              <span className="text-gray-300">/</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">Monthly Overview</span>
            </div>
          </div>

          <div>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 lg:gap-8 w-full">
              {/* Month Selector */}
              <div className="text-center w-full md:w-auto mt-2 lg:mt-0">
                <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Select Month
                </p>
                <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm">
                  <button onClick={previous} className="flex items-center justify-center rounded-lg w-8 h-8 text-gray-600 border border-gray-200 bg-white hover:bg-blue-50 transition-all group">
                    <FaLongArrowAltLeft size={14} className="text-gray-500 group-hover:text-blue-600 transition-all" />
                  </button>
                  <span className="text-sm font-bold w-24 text-center text-gray-800 bg-blue-50/50 py-1.5 rounded-lg border border-blue-100">
                    {months[selectedMonth]}
                  </span>
                  <button onClick={next} className="flex items-center justify-center rounded-lg w-8 h-8 text-gray-600 border border-gray-200 bg-white hover:bg-blue-50 transition-all group">
                    <FaLongArrowAltRight size={14} className="text-gray-500 group-hover:text-blue-600 transition-all" />
                  </button>
                </div>
              </div>

              {/* Department Selector */}
              <div className="text-center w-full md:w-auto">
                <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Department
                </p>
                <div className="relative">
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full md:w-56 appearance-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gradient-to-r from-white to-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm cursor-pointer hover:border-blue-300 transition-all"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Year Selector */}
              <div className="text-center w-full md:w-auto lg:me-10">
                <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Select Year
                </p>
                <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm">
                  <button onClick={previousYear} className="flex items-center justify-center rounded-lg w-8 h-8 text-gray-600 border border-gray-200 bg-white hover:bg-blue-50 transition-all group">
                    <FaLongArrowAltLeft size={14} className="text-gray-500 group-hover:text-blue-600 transition-all" />
                  </button>
                  <span className="text-sm font-bold w-20 text-center text-gray-800 bg-green-50/50 py-1.5 rounded-lg border border-green-100">
                    {selectedYear}
                  </span>
                  <button onClick={nextYear} className="flex items-center justify-center rounded-lg w-8 h-8 text-gray-600 border border-gray-200 bg-white hover:bg-blue-50 transition-all group">
                    <FaLongArrowAltRight size={14} className="text-gray-500 group-hover:text-blue-600 transition-all" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition duration-200 md:flex">
              <HiMiniAdjustmentsHorizontal className="text-blue-600" size={20} />
              <span className="text-sm font-medium text-gray-700">Filter</span>
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="items-center justify-between">
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 sm:p-5 border border-gray-200">
                <div className="flex items-center gap-2 bg-gradient-to-br from-blue-50 to-indigo-50/50 px-4 py-2 rounded-xl border border-blue-200 shadow-sm justify-center">
                  <FaRegCalendarAlt className="text-blue-500 text-lg" />
                  <div className="flex items-baseline gap-1.5 ">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today</span>
                    <span className="text-sm font-semibold text-gray-800 bg-white px-2 py-0.5 rounded-lg border border-blue-100">
                      {date}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-center lg:justify-start max-w-full ">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 shadow-sm ">
                    <FaRegCheckCircle className="text-green-500" /> <span className="text-xs font-medium text-gray-700">Present</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 shadow-sm ">
                  <FaRegCheckCircle className="text-red-500" /> <span className="text-xs font-medium text-gray-700">Punch Miss</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 shadow-sm">
                    <ImCancelCircle className="text-red-500" /> <span className="text-xs font-medium text-gray-700">Absent</span>
                  </span>
                  
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-50 border border-purple-200 shadow-sm">
                    <CiStar className="text-purple-500" /> <span className="text-xs font-medium text-gray-700">Holiday</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 shadow-sm">
                    <FaRegCalendarAlt className="text-orange-500" /> <span className="text-xs font-medium text-gray-700">Leave</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 border border-yellow-200 shadow-sm">
                    <MdOutlineAccessTime className="text-yellow-500" /> <span className="text-xs font-medium text-gray-700">Late/EarlyGo</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 shadow-sm">
                    <MdDriveEta className="text-blue-500" /> <span className="text-xs font-medium text-gray-700">OD</span>
                  </span>
                  
                  
                </div>

                <div className="flex items-center justify-center lg:justify-end gap-3">
                  {/* <button className="group relative flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 hover:border-red-300 transition-all">
                    <BiSolidFilePdf size={18} className="text-red-500" />
                    <span className="text-xs font-medium text-gray-700 hidden sm:inline">PDF</span>
                  </button> */}
                  <button className="group relative flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200 hover:border-green-300 transition-all" onClick={() => exportMonthlyAttendance(filteredEmployees)}>
                    <FaFileExcel size={18} className="text-green-600" />
                    <span className="text-xs font-medium text-gray-700 hidden sm:inline">Excel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
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
                      <th key={day} className={`border border-gray-300 px-2 py-2 text-center ${isSunday ? "bg-orange-300" : ""}`}>
                        <div className="text-xs text-gray-800">{day}</div>
                        <div className="text-xs text-gray-600">{weekDay}</div>
                      </th>
                    );
                  })}

                </tr>
              </thead>

              <tbody>
                {filteredEmployees
                  .filter((emp) => emp.is_active === true)
                  .map(
                    (emp) =>
                      emp.emp_id !== "2020" && (
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
                            const dateStr = `${selectedYear}-${String(
                              selectedMonth + 1
                            ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                            const today = new Date();
                            // year-month-date
                            const currentDate = new Date(
                              today.getFullYear(),
                              today.getMonth(),
                              today.getDate()
                            )

                            // current Date of cell
                            const cellDate = new Date(selectedYear, selectedMonth, day);

                            // console.log("cellDate",cellDate)

                            // finding the Future Date

                            const isFutureDate = currentDate < cellDate;

                            const isHoliday = holidayDates.includes(dateStr);

                            const dayData = emp.attendance?.find(
                              (a) => a.date === dateStr
                            );


                            // console.log("dayData",dayData);

                            const weekDayIndex = new Date(
                              selectedYear,
                              selectedMonth,
                              day
                            ).getDay();

                            const isSunday = weekDayIndex === 0;

                            return (
                              <td
                                key={`${emp.emp_id}-${day}`}
                                className={`border border-gray-200 px-2 sm:px-4 py-2 text-center
                    ${isSunday
                                    ? "bg-orange-50 text-orange-600 font-semibold"
                                    : ""
                                  }`}
                              >
                                {
                                  isFutureDate ? ("--") : isHoliday ? (
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
                      )
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}