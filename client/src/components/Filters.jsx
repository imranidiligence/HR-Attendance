import React, { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { IoSearchOutline } from "react-icons/io5";
import { HiMiniFunnel } from "react-icons/hi2";
import { EmployContext } from "../context/EmployContextProvider";
import { exportToExcel } from "../utils/exportToExcel";
import { exportAdminAttendanceToExcel } from "../utils/adminToExcel";
import { IoMdRefreshCircle } from "react-icons/io";
import { downloadFullExcel } from "../utils/downloadFullExcel";
import { exportWeekToExcel } from "../utils/weekToExcel";
import { exportActivityToExcel } from "../utils/activityToExcel";



const Filters = ({ activityLogs = [] }) => {
  const location = useLocation();
  const {
    filters,
    setFilters,
    handleFilterChange,
    adminAttendance,
    employeeAttendance,
    singleAdminAttendance,
    formatDate,
    weeklyData,
    weekTime,
  } = useContext(EmployContext);

  // console.log("WeekTime",weekTime)

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role?.toLowerCase();
  const todayPlaceholder = new Date();

  // Helper to safely convert YYYY-MM-DD string from state back to a Date object for the picker
  const safeParseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string") return null;
    const [year, month, day] = dateStr.split("-");
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  };

  const getActiveConfig = () => {
    const path = location.pathname;

    if (path.includes("admin/attendance")) {
      return {
        key: "attendanceSearch",
        label: "Attendance",
        isAttendancePage: true,
      };
    }
    if (path.includes("admin/admin-attendance")) {
      return {
        key: "adminAttSearch",
        startKey: "adminStart",
        endKey: "adminEnd",
        label: "Admin Attendance",
        isAdminAttendancePage: true,
      };
    }
    if (path.includes("admin/activity-log")) {
      return {
        key: "activitySearch",
        startKey: "actStart",
        endKey: "actEnd",
        label: "Activity",
        weekTime: "",
        isActivityPage: true,
      };
    }
    if (
      path.includes("employee/attendance") ||
      path.includes("admin/my-dashboard/attendance")
    ) // || path.includes("/admin/my-dashboard/attendance"))
    {
      return {
        key: "employeeSearch",
        startKey: "startDate",
        endKey: "endDate",
        label: "My Attendance",
        isEmployeePage: true,
      };
    }

    if (path.includes("admin/week")) {
      return {
        key: "weekSearch",
        label: "Weekly Attendance",
        isWeeklyPage: true,
        weekTime: "", // optional, will hold time filter value
        startTime: "", // start of time range
        endTime: "", // end of time range
      };
    }
    return { key: "search", label: "Employee", isDefault: true };
  };

  const config = getActiveConfig();

  const resetFilter = () => {
    setFilters((prev) => ({
      ...prev,
      [config.startKey]: "",
      [config.endKey]: "",
      [config.key]: "",
      punchInTime: "",
      punchOutTime: "",
    }));
  };

  const handleDateChange = (date, fieldName) => {
    if (!date) {
      setFilters((prev) => ({ ...prev, [fieldName]: "" }));
      return;
    }
    // Store as YYYY-MM-DD for backend compatibility
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    setFilters((prev) => ({ ...prev, [fieldName]: `${year}-${month}-${day}` }));
  };

  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full bg-[#4f565b] p-3 md:p-2 rounded-md">
      {/* LEFT SECTION: Date Filters */}
      {config.startKey && (
        <div className="flex flex-row items-center gap-2 w-full md:w-auto justify-between md:justify-start flex-wrap">
          <div className="flex items-center gap-2 text-white bg-[#3f4549] md:bg-transparent px-2 py-1.5 rounded flex-1 md:flex-none justify-center">
            <label className="text-xs md:text-sm font-medium">From:</label>
            <DatePicker
              selected={safeParseDate(filters[config.startKey])}
              onChange={(date) => handleDateChange(date, config.startKey)}
              placeholderText={formatDate(todayPlaceholder)}
              dateFormat="dd-MM-yyyy" // Updated from / to -
              portalId="root-portal"
              popperClassName="z-[9999]"
              popperPlacement="bottom-start"
              className="bg-white text-black px-2 py-1 rounded outline-none w-24 md:w-28 text-xs md:text-sm"
            />
          </div>

          <div className="flex items-center gap-2 text-white bg-[#3f4549] md:bg-transparent px-2 py-1.5 rounded flex-1 md:flex-none justify-center">
            <label className="text-xs md:text-sm font-medium">To:</label>
            <DatePicker
              selected={safeParseDate(filters[config.endKey])}
              onChange={(date) => handleDateChange(date, config.endKey)}
              placeholderText={formatDate(todayPlaceholder)}
              dateFormat="dd-MM-yyyy" // Updated from / to -
              portalId="root-portal"
              popperClassName="z-[9999]"
              popperPlacement="bottom-start"
              className="bg-white text-black px-2 py-1 rounded outline-none w-24 md:w-28 text-xs md:text-sm"
            />
          </div>

          <button
            type="button"
            onClick={resetFilter}
            className="bg-white p-2 rounded shadow-sm hover:bg-gray-200 transition-all flex items-center justify-center h-[32px] w-[32px]"
            title="Reset Filters"
          >
            <HiMiniFunnel className="text-black text-lg" />
          </button>
        </div>
      )}

      {role === "admin" &&
        location.pathname !== "/employee/attendance" &&
        location.pathname !== "/admin/my-dashboard/attendance" && (
          <div className="relative w-full md:max-w-[250px] lg:max-w-[300px]">
            <input
              type="text"
              name={config.key}
              value={filters[config.key] || ""}
              onChange={handleFilterChange}
              placeholder={`Search ${config.label} ( empId / punch-in / punch-out)...`}
              className="w-full border border-gray-300 pl-4 pr-10 py-2 md:py-1.5 rounded outline-none text-sm focus:border-blue-500"
            />
            <IoSearchOutline className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 font-bold" />
          </div>
        )}
      {/* {role === "admin" && location.pathname.includes("/week") && (
  <div className="relative w-full md:max-w-[300px]">
    <input
      type="text"
      name={config.key}
      value={filters[config.key] || ""}
      onChange={handleFilterChange}
      placeholder={`Search ${config.label} (name / empid / time)...`}
      className="w-full border border-gray-300 pl-4 pr-10 py-2 md:py-1.5 rounded outline-none text-sm focus:border-blue-500"
    />
    <IoSearchOutline className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 font-bold" />
  </div>
)} */}

      {/* RIGHT SECTION: Buttons */}
      <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-3 border-t border-gray-100 md:border-none pt-4 md:pt-0">
        <button
          onClick={refreshPage}
          className="h-9 w-9 flex items-center justify-center bg-gray-200 rounded-lg hover:bg-gray-300 transition-all text-gray-700"
          title="Refresh"
        >
          <IoMdRefreshCircle size={24} />
        </button>

        <div className="flex gap-3">
          {config.isAttendancePage && (
            <button
              onClick={() =>
                exportToExcel(adminAttendance, null, "Attendance_Report")
              }
              className="h-9 w-9 flex items-center justify-center bg-gray-50 text-black rounded-lg transition-all shadow-sm"
            >
              <ExcelIcon />
            </button>
          )}

          {config.isAdminAttendancePage && (
            <button
              onClick={() =>
                exportAdminAttendanceToExcel(
                  singleAdminAttendance,
                  "Admin-Attendance",
                )
              }
              className="h-9 w-9 flex items-center justify-center bg-gray-50 text-black rounded-lg transition-all shadow-sm"
            >
              <ExcelIcon />
            </button>
          )}

          {config.isActivityPage && (
            <button
              onClick={() => {
                if (!activityLogs.length) {
                  alert("No records available to export.");
                  return;
                }

                exportActivityToExcel(
                  activityLogs,
                  `Activity_Log_Page_${new Date().toISOString().split("T")[0]}`,
                );
              }}
              className="h-9 w-9 flex items-center justify-center bg-gray-50 text-black rounded-lg transition-all shadow-sm border border-gray-200"
              title="Export Current Page"
            >
              <ExcelIcon />
            </button>
          )}

          {(config.isEmployeePage || config.isWeeklyPage) && (
            <button
              onClick={() =>
                config.isWeeklyPage
                  ? exportWeekToExcel(weeklyData, null, "Weekly_Attendance")
                  : exportToExcel(employeeAttendance, null, "My_Attendance")
              }
              className="h-9 w-9 flex items-center justify-center bg-gray-50 text-black rounded-lg transition-all shadow-sm"
            >
              <ExcelIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ExcelIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 384 512"
    height="16"
    width="16"
  >
    <path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm60.1 106.5L224 336l60.1 93.5c5.1 8-.6 18.5-10.1 18.5h-34.9c-4.4 0-8.5-2.4-10.6-6.3C208.9 405.5 192 373 192 373c-6.4 14.8-10 20-36.6 68.8-2.1 3.9-6.1 6.3-10.5 6.3H110c-9.5 0-15.2-10.5-10.1-18.5l60.3-93.5-60.3-93.5c-5.2-8 .6-18.5 10.1-18.5h34.8c4.4 0 8.5 2.4 10.6 6.3 26.1 48.8 20 33.6 36.6 68.5 0 0 6.1-11.7 36.6-68.5 2.1-3.9 6.2-6.3 10.6-6.3H274c9.5-.1 15.2 10.4 10.1 18.4zM384 121.9v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z"></path>
  </svg>
);

export default Filters;
