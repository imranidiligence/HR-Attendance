import { Typography, Box } from "@mui/material";
import React, { useContext, useEffect, useMemo, useState } from "react";
import Table from "../components/Table";
import { EmployContext } from "../context/EmployContextProvider";
import Loader from "../components/Loader";
import Filters from "../components/Filters";
import { useLocation } from "react-router-dom";
import api from "../../api/axiosInstance";
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

  // Local state for all data
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10,
  });

  // Get filters from context
  const { filters } = useContext(EmployContext);

  const isDailyAttendance = location.pathname.startsWith("/admin/attendance");
  const isHistoryAttendance = !isDailyAttendance;

  // Fetch data based on path
  const fetchAttendance = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      let url = "";
      let limit = 10;

      if (isDailyAttendance) {
        // Admin Daily Attendance - 10 per page
        url = `${import.meta.env.VITE_API_URL}/admin/attendance/today?page=${page}&limit=10`;
      } else {
        // Employee Attendance History - 15 per page
        url = `${import.meta.env.VITE_API_URL}/employee/attendance/history?page=${page}&limit=15`;
        limit = 15;

        if (filters.startDate) {
          url += `&startDate=${filters.startDate}`;
        }
        if (filters.endDate) {
          url += `&endDate=${filters.endDate}`;
        }
      }

      const res = await api.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Set data based on response structure
      if (isDailyAttendance) {
        setAttendance(res.data.employees || []);
      } else {
        setAttendance(res.data.attendance || []);
      }

      // Update pagination
      if (res.data.pagination) {
        setPagination({
          ...res.data.pagination,
          limit: limit,
        });
      }
    } catch (err) {
      console.error("Error fetching attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (_, page) => {
    fetchAttendance(page);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Fetch on mount and when path or filters change
  useEffect(() => {
    fetchAttendance(1);
  }, [isDailyAttendance, filters.startDate, filters.endDate]);

  // Date header
  const date = new Date();
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  // Table Headers - memoized
  const adminTableHeader = useMemo(
    () => [
      "Sr.No",
      "Emp ID",
      "Employee Name",
      "Date",
      "Punch In",
      "Punch Out",
      "Status",
      "Expected Hours",
      "Actual Working Hours",
    ],
    [],
  );

  const employeeTableHeader = useMemo(
    () => [
      "Sr.No",
      "Emp ID",
      "Employee Name",
      "Date",
      "Status",
      "Punch In",
      "Punch Out",
      "Actual Working Hours",
      "Expected Hours",
    ],
    [],
  );

  // Prepare table data
  const tableData = attendance.map((item, index) => ({
    srNo: (pagination.currentPage - 1) * pagination.limit + index + 1,
    empId: item.emp_id || item.device_user_id,
    name: item.name || item.employee_name,
    date: item.attendance_date,
    status: item.status,
    punchIn: item.punch_in || "--",
    punchOut: item.punch_out || "--",
    workingHours: formatHours(item.total_hours),
    expectedHours: formatHours(item.expected_hours),
  }));

  const headers = isDailyAttendance ? adminTableHeader : employeeTableHeader;

  // Status color mapping
  const statusColor = {
    Present: "bg-green-600 text-white",
    Working: "bg-blue-600 text-white",
    Absent: "bg-red-600 text-white",
    "Late Come": "bg-orange-500 text-white",
    "Half Day": "bg-orange-500 text-white",
    "Early Go": "bg-yellow-400 text-black",
  };
  console.log("Attendance Data:", attendance);

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
          {isDailyAttendance ? "Daily Attendance" : "Attendance"}
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

          {isDailyAttendance ? (
            // Admin Daily Attendance Table
            <div className="max-h-[800px] w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border-b px-4 py-3 text-left">Sr No</th>
                    <th className="border-b px-4 py-3 text-left">Emp ID</th>
                    <th className="border-b px-4 py-3 text-left">Employee</th>
                    <th className="border-b px-4 py-3 text-left">Date</th>
                    <th className="border-b px-4 py-3 text-left">Status</th>
                    <th className="border-b px-4 py-3 text-left">Punch In</th>
                    <th className="border-b px-4 py-3 text-left">Punch Out</th>
                    <th className="border-b px-4 py-3 text-left">
                      Working Hours
                    </th>
                    <th className="border-b px-4 py-3 text-left">
                      Expected Hours
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {attendance
                    .filter(
                      (row) =>
                        row.emp_id && row.is_active && row.emp_id !== "2020",
                    )
                    .map((row, index) => {
                      return (
                        <tr
                          key={row.emp_id || index}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td className="border-b px-4 py-2">
                            {(pagination.currentPage - 1) * pagination.limit +
                              index +
                              1}
                          </td>

                          <td className="border-b px-4 py-2">{row.emp_id}</td>

                          <td className="border-b px-4 py-2">{row.name}</td>

                          <td className="border-b px-4 py-2">
                            {new Date(row.attendance_date).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )}
                          </td>

                          <td className="border-b px-4 py-2">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold w-20 text-center ${
                                statusColor[row.status] ||
                                "bg-gray-300 text-gray-800"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>

                          <td className="border-b px-4 py-2">
                            {row.punch_in || "--"}
                          </td>

                          <td className="border-b px-4 py-2">
                            {row.punch_out ||
                              (row.status === "Working" ? "Working..." : "--")}
                          </td>

                          <td className="border-b px-4 py-2">
                            {row.total_hours || "00:00"}
                          </td>

                          <td className="border-b px-4 py-2">9.3</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            // Employee History Table
            <Table
              attendanceData={attendance}
              loading={loading}
              isAdminView={isAdmin && isDailyAttendance}
              pagination={pagination}
            />
          )}

          {/* Pagination */}
          <Box className="mt-6 flex justify-center pb-4">
            <Pagination
              totalPages={pagination.totalPages}
              page={pagination.currentPage}
              totalRecords={pagination.totalItems}
              limit={pagination.limit}
              onChange={handlePageChange}
            />
          </Box>

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
