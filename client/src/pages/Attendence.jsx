import { Typography, Box } from "@mui/material";
import React, { useContext, useEffect, useMemo, useCallback } from "react";
import Table from "../components/Table";
import { EmployContext } from "../context/EmployContextProvider";
import Loader from "../components/Loader";
import Filters from "../components/Filters";
import { useLocation } from "react-router-dom";
import Pagination from "../components/Pagination";

const formatHours = (val) => {
  if (!val) return "00:00";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    const h = String(val.hours || 0).padStart(2, "0");
    const m = String(val.minutes || 0).padStart(2, "0");
    return `${h}:${m}`;
  }
  return "00:00";
};

const Attendance = () => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role?.toLowerCase()?.trim();
  const isAdmin = role === "admin";

  const {
    filters,
    adminAttendance = [],
    employeeAttendance = [],
    loading,
    pagination,
    adminPagination,
    refreshEmployeeDashboard,
    fetchAdminAttendance,
    handleAdminPageChange,
    refreshAdminAttendance,
  } = useContext(EmployContext);
console.log("AdminPagination:", adminPagination);
  // Detect which view we're in
  const isEmployee = location.pathname.startsWith("/employee");
  const isMyDashboard = location.pathname.startsWith(
    "/admin/my-dashboard/attendance",
  );
  const isDailyAttendance = location.pathname.startsWith("/admin/attendance");

  const showPagination = isEmployee || isMyDashboard || isDailyAttendance;
  const isAdminWithEmp = isAdmin && isMyDashboard;

  const date = new Date();
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  // Fetch data on filter or role change - with proper dependencies
  useEffect(() => {
    if (isAdmin) {
      if (isDailyAttendance) {
        // For admin daily attendance, fetch today's attendance
        refreshAdminAttendance();
      } else {
        // For admin my-dashboard, fetch employee's history
        refreshEmployeeDashboard(1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.search, isAdmin, isDailyAttendance]);

  // Handle page change based on view - memoized to prevent recreation
  const handlePageChange = useCallback((event, value) => {
    if (isAdmin && isDailyAttendance) {
      if (handleAdminPageChange) {
        handleAdminPageChange(value);
      } else if (fetchAdminAttendance) {
        fetchAdminAttendance(value);
      }
    } else {
      refreshEmployeeDashboard(value);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isAdmin, isDailyAttendance, handleAdminPageChange, fetchAdminAttendance, refreshEmployeeDashboard]);

  // Table Headers - memoized to prevent recreation
  const adminTableHeader = useMemo(() => [
    "Sr.No",
    "Emp ID",
    "Employee Name",
    "Date",
    "Punch In",
    "Punch Out",
    "Status",
    "Expected Hours",
    "Actual Working Hours",
  ], []);

  const employeeTableHeader = useMemo(() => [
    "Sr.No",
    "Emp ID",
    "Employee Name",
    "Date",
    "Status",
    "Punch In",
    "Punch Out",
    "Actual Working Hours",
    "Expected Hours",
  ], []);

  // Prepare raw data and pagination based on view - memoized
  const { rawData, currentPagination } = useMemo(() => {
    let rawData = [];
    let currentPagination = null;

    if (isAdmin && isDailyAttendance) {
      rawData = adminAttendance;
      currentPagination = adminPagination || {
        currentPage: 1,
        totalPages: Math.ceil(adminAttendance.length / 10),
        totalItems: adminAttendance.length,
        limit: 10,
      };
    } else if (isAdmin && isMyDashboard) {
      rawData = employeeAttendance;
      currentPagination = pagination;
    } else if (isEmployee) {
      rawData = employeeAttendance;
      currentPagination = pagination;
    } else {
      rawData = employeeAttendance;
      currentPagination = pagination;
    }

    return { rawData, currentPagination };
  }, [isAdmin, isDailyAttendance, isMyDashboard, isEmployee, adminAttendance, adminPagination, employeeAttendance, pagination]);

  // Memoize table data
  const tableData = useMemo(() => {
    // For admin daily attendance, we need to show today's employees only
    if (isAdmin && isDailyAttendance) {
      return rawData.map((item, index) => ({
        srNo: index + 1,
        empId: item.emp_id || item.device_user_id,
        name: item.name || item.employee_name,
        date: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        punchIn: item.punch_in || "--",
        punchOut: item.punch_out || "--",
        workingHours: formatHours(item.total_hours),
        expectedHours: formatHours(item.expected_hours),
        status: item.status || "--",
      }));
    }

    // For employee views with pagination
    return rawData.map((item, index) => {
      const currentPage = currentPagination?.currentPage || 1;
      const pageLimit = currentPagination?.limit || 15;
      const srNo = (currentPage - 1) * pageLimit + index + 1;

      return {
        srNo,
        empId: item.device_user_id || item.emp_id,
        name: item.name || item.employee_name,
        date: item.attendance_date,
        punchIn: item.punch_in || "--",
        punchOut: item.punch_out || "--",
        workingHours: formatHours(item.total_hours),
        expectedHours: formatHours(item.expected_hours),
        status: item.status || "--",
      };
    });
  }, [rawData, currentPagination, isAdmin, isDailyAttendance]);

  return (
    <div className="min-h-max bg-gradient-to-br blur-0 bg-white px-3 pb-6">
      {/* HEADER */}
      <div
        className={`sticky z-20 top-0 bg-[#222F7D] rounded-xl py-2 mb-1 shadow-lg flex justify-between items-center px-6 ${
          location.pathname.startsWith("/employee/attendance")
            ? "mt-[17px]"
            : "mt-[8px]"
        }`}
      >
        <div className="w-8 text-nowrap text-white justify-start">{`Date: ${day}-${month}-${year}`}</div>
        <Typography className="text-white font-bold" sx={{ fontSize: "1rem" }}>
          {isMyDashboard || isEmployee ? "Attendance" : "Daily Attendance"}
        </Typography>
        <div></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[70vh]">
          <Loader />
        </div>
      ) : (
        <div className="-inset-1.5">
          <Filters />

          <Table
            headers={
              isAdmin && !isAdminWithEmp
                ? adminTableHeader
                : employeeTableHeader
            }
            data={tableData}
            isAdminWithEmp={isAdminWithEmp}
          />

          {/* Show pagination when there are multiple pages */}
          {showPagination && currentPagination?.totalPages > 1 && (
            <Box className="mt-6 flex justify-center pb-4">
              <Pagination
                totalPages={currentPagination.totalPages}
                page={currentPagination.currentPage}
                totalRecords={currentPagination.totalItems}
                limit={currentPagination.limit}
                onChange={handlePageChange}
              />
            </Box>
          )}

          {tableData.length === 0 && !loading && (
            <Typography className="text-center text-gray-500 mt-10">
              No data available for the selected filters.
            </Typography>
          )}
        </div>
      )}
    </div>
  );
};

export default Attendance;