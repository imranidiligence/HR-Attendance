import { Typography } from "@mui/material";
import React, { useEffect, useState, useCallback, useContext } from "react";
import axios from "axios";
import Filters from "../components/Filters";
import Loader from "../components/Loader";
import { EmployContext } from "../context/EmployContextProvider";
import api from "../../api/axiosInstance";

const AdminActivityLog = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [jumpPage, setJumpPage] = useState("");
  const [totalLogs, setTotalLogs] = useState(0);

  const { setActiveLogs, formatDate, filters } = useContext(EmployContext);

  useEffect(() => {
    console.log("filters", filters);
  }, [filters]);
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // 1. Build Query Params using URLSearchParams (Cleanest way)
      const params = new URLSearchParams({
        page: page,
        limit: limit,
      });

      if (filters.actStart) params.append("from", filters.actStart);
      if (filters.actEnd) params.append("to", filters.actEnd);

      if (filters.activitySearch) {
        const searchTerm = filters.activitySearch.trim();
        // We send it as 'search' so the backend detects the ':' for time-based search
        params.append("search", searchTerm);
      }

      const url = `admin/attendance/activity-log?${params.toString()}`;

      const res = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const logs = res.data.data || [];
      console.log("Fetched res:", res.data);
      setData(logs);
      setActiveLogs(logs);
      setPagination(res.data.pagination || { currentPage: 1, totalPages: 1 });
      setTotalLogs(res.data.pagination.totalRecords || 0);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    filters.actStart,
    filters.actEnd,
    filters.activitySearch,
    setActiveLogs,
  ]);

  // Debounced fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(handler);
  }, [fetchLogs]);

  // Reset page to 1 when search or dates change
  useEffect(() => {
    setPage(1);
  }, [filters.activitySearch, filters.actStart, filters.actEnd, limit]);

  const handleJumpPageSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage);
    if (pageNum > 0 && pageNum <= pagination.totalPages) {
      setPage(pageNum);
      setJumpPage("");
    } else {
      alert(`Please enter a page between 1 and ${pagination.totalPages}`);
    }
  };

  if (loading && data.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-white/50">
        <Loader />
      </div>
    );
  }

  // pagination
  const startRecord = totalLogs === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalLogs);

  // Generate page numbers
  const getPageNumbers = () => {
    const total = pagination.totalPages;
    const current = page;

    if (total <= 7) {
      return [...Array(total)].map((_, i) => i + 1);
    }

    const pages = [];

    pages.push(1);

    if (current > 3) {
      pages.push("...");
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push("...");
    }

    pages.push(total);

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="min-h-screen py-1 px-4 bg-gray-50">
      <div className="sticky z-20 top-0 bg-[#222F7D] rounded-xl py-2 mb-1 shadow-lg flex justify-center items-center px-6 mt-[3px]">
        <div className="w-10"></div> {/* Spacer to center text */}
        <Typography className="text-white font-bold" sx={{ fontSize: "1rem" }}>
          Activity-Log
        </Typography>
      </div>

      <Filters activityLogs={data} />

      <div className="relative overflow-auto w-full border border-gray-300 rounded max-h-[550px] mt-4 bg-white shadow-sm">
        <table
          className={`min-w-full text-sm border-collapse transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}
        >
          <thead className="bg-gray-100 sticky top-0 left-0 z-8">
            <tr className="divide-x divide-gray-200">
              {[
                "Sr No",
                "Emp ID",
                "Punch Date",
                "Punch Time",
                "Received Time",
                "Device IP",
                "Device SN",
              ].map((h, i) => (
                <th
                  key={i}
                  className="border-b px-4 py-3 font-bold text-left text-[#222F7D] bg-gray-100"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((row, i) => {
                const pDate = new Date(row.punch_time);
                const punchTime = isNaN(pDate)
                  ? "--"
                  : pDate.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    });
                const receivedDate = new Date(row.received_time);
                const receivedTime = isNaN(receivedDate)
                  ? "--"
                  : receivedDate.toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    });

                return (
                  <tr key={i} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-2 text-gray-500">
                      {(page - 1) * limit + (i + 1)}
                    </td>
                    <td className="px-4 py-2 font-bold text-gray-800">
                      {row.emp_id}
                    </td>
                    <td className="px-4 py-2">{formatDate(row.punch_time)}</td>
                    <td className="px-4 py-2 text-blue-700 font-semibold">
                      {punchTime}
                    </td>
                    <td className="px-4 py-2 text-blue-700 font-semibold">
                      {receivedTime}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{row.device_ip}</td>
                    <td className="px-4 py-2 text-xs font-mono text-gray-400">
                      {row.device_sn}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-20 text-gray-400">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-center mt-5 bg-white border rounded-lg shadow-sm px-5 py-4 gap-4">
        {/* Left Side */}
        <div className="flex flex-wrap items-center gap-5">
          <p className="text-sm text-gray-600">
            Showing <b>{startRecord}</b> - <b>{endRecord}</b> of{" "}
            <b>{totalLogs}</b> Logs
          </p>

          <div className="flex items-center gap-2">
            <span className="text-sm">Rows:</span>

            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              {[10, 20, 50, 100].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Previous */}
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className={`px-3 py-1 rounded border text-sm ${
              page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"
            }`}
          >
            Prev
          </button>

          {/* Page Numbers */}
          {pageNumbers.map((item, index) =>
            item === "..." ? (
              <span key={index} className="px-2">
                ...
              </span>
            ) : (
              <button
                key={index}
                onClick={() => setPage(item)}
                className={`w-9 h-9 rounded text-sm font-medium transition ${
                  page === item
                    ? "bg-[#222F7D] text-white"
                    : "border hover:bg-gray-100"
                }`}
              >
                {item}
              </button>
            ),
          )}

          {/* Next */}
          <button
            disabled={page === pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className={`px-3 py-1 rounded border text-sm ${
              page === pagination.totalPages
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-100"
            }`}
          >
            Next
          </button>

          {/* Jump */}
          <form
            onSubmit={handleJumpPageSubmit}
            className="flex items-center gap-2 ml-4"
          >
            <input
              type="number"
              min={1}
              max={pagination.totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              className="w-16 border rounded px-2 py-1 text-sm"
              placeholder="Page"
            />

            <button
              type="submit"
              className="bg-[#222F7D] text-white px-3 py-1 rounded hover:bg-blue-800"
            >
              Go
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminActivityLog;
