import React, { useContext } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"; // Required for styling
import { IoSearchOutline } from "react-icons/io5";
import { HiMiniFunnel } from "react-icons/hi2";
import { EmployContext } from "../context/EmployContextProvider";
import { exportToExcel } from "../utils/exportToExcel";

const Filters = ({ adminData }) => {
  const { 
    filters, 
    setFilters, 
    handleFilterChange, 
    adminAttendance, 
    employeeAttendance 
  } = useContext(EmployContext);

  // Get user role and today's date for logic
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role?.toLowerCase();
  
  // Create the placeholder string: e.g., "24/01/2026"
  const todayPlaceholder = new Date().toLocaleDateString("en-GB");

  const resetFilter = () => {
    // Reset to empty strings so the placeholderText shows up again
    setFilters({ 
      startDate: "", 
      endDate: "", 
      search: "" 
    });
  };

  // Helper to handle DatePicker changes and sync with your Context
  const handleDateChange = (date, fieldName) => {
    if (date) {
      // Formats date to YYYY-MM-DD for your backend/logic
      const formattedDate = date.toISOString().split("T")[0];
      setFilters((prev) => ({ ...prev, [fieldName]: formattedDate }));
    } else {
      setFilters((prev) => ({ ...prev, [fieldName]: "" }));
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 w-full flex-wrap bg-[#4f565b] p-2 rounded-md">
      
      {/* LEFT SECTION: Date Filters using React-Datepicker */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* From Date */}
        <div className="flex items-center gap-2 text-white px-3 py-2 rounded">
          <label className="text-sm font-medium">From:</label>
          <DatePicker
            selected={filters.startDate ? new Date(filters.startDate) : null}
            onChange={(date) => handleDateChange(date, "startDate")}
            placeholderText={todayPlaceholder}
            dateFormat="dd/MM/yyyy"
            className="bg-white text-black px-2 py-1 rounded outline-none w-28 text-sm"
          />
        </div>

        {/* To Date */}
        <div className="flex items-center gap-2 text-white px-3 py-2 rounded">
          <label className="text-sm font-medium">To:</label>
          <DatePicker
            selected={filters.endDate ? new Date(filters.endDate) : null}
            onChange={(date) => handleDateChange(date, "endDate")}
            placeholderText={todayPlaceholder}
            dateFormat="dd/MM/yyyy"
            className="bg-white text-black px-2 py-1 rounded outline-none w-28 text-sm"
          />
        </div>

        {/* Reset Button */}
        <button 
          type="button"
          onClick={resetFilter}
          className="bg-white p-2 rounded shadow-sm hover:bg-gray-200 transition-all active:scale-95 flex items-center justify-center"
          title="Reset Filters"
        >
          <HiMiniFunnel className="text-black text-lg" />
        </button>
      </div>

      {/* MIDDLE SECTION: Search (Admin Only) */}
      {role === "admin" && (
        <div className="relative w-full max-w-[300px]">
          <input
            type="text"
            name="search"
            value={filters.search || ""}
            onChange={handleFilterChange}
            placeholder="Search employee..."
            className="w-full border border-gray-300 pl-4 pr-10 py-1.5 rounded outline-none text-sm"
          />
          <IoSearchOutline className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 font-bold" />
        </div>
      )}

      {/* RIGHT SECTION: Action Buttons */}
      <div className="flex gap-2 flex-none px-2">
        <button className="px-3 py-2 bg-gray-200 rounded hover:bg-white transition-colors" title="Settings">
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M413.967 276.8c1.06-6.235 1.06-13.518 1.06-20.8s-1.06-13.518-1.06-20.8l44.667-34.318c4.26-3.118 5.319-8.317 2.13-13.518L418.215 115.6c-2.129-4.164-8.507-6.235-12.767-4.164l-53.186 20.801c-10.638-8.318-23.394-15.601-36.16-20.801l-7.448-55.117c-1.06-4.154-5.319-8.318-10.638-8.318h-85.098c-5.318 0-9.577 4.164-10.637 8.318l-8.508 55.117c-12.767 5.2-24.464 12.482-36.171 20.801l-53.186-20.801c-5.319-2.071-10.638 0-12.767 4.164L49.1 187.365c-2.119 4.153-1.061 10.399 2.129 13.518L96.97 235.2c0 7.282-1.06 13.518-1.06 20.8s1.06 13.518 1.06 20.8l-44.668 34.318c-4.26 3.118-5.318 8.317-2.13 13.518L92.721 396.4c2.13 4.164 8.508 6.235 12.767 4.164l53.187-20.801c10.637 8.318 23.394 15.601 36.16 20.801l8.508 55.117c1.069 5.2 5.318 8.318 10.637 8.318h85.098c5.319 0 9.578-4.164 10.638-8.318l8.518-55.117c12.757-5.2 24.464-12.482 36.16-20.801l53.187 20.801c5.318 2.071 10.637 0 12.767-4.164l42.549-71.765c2.129-4.153 1.06-10.399-2.13-13.518l-46.8-34.317zm-158.499 52c-41.489 0-74.46-32.235-74.46-72.8s32.971-72.8 74.46-72.8 74.461 32.235 74.461 72.8-32.972 72.8-74.461 72.8z"></path></svg>
        </button>

        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-white transition-colors" title="Export PDF">
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 384 512" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-12.7-9.6-24.9-23.4-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 17.9 0 35.7-18 61.1-61.8 25.8-8.5 54.1-19.1 79-23.2 21.7 11.8 47.1 19.5 64 19.5 29.2 0 31.2-32 19.7-43.4-13.9-13.6-54.3-9.7-73.6-7.2zM377 105L279 7c-4.5-4.5-10.6-7-17-7h-6v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zm-74.1 255.3c4.1-2.7-2.5-11.9-42.8-9 37.1 15.8 42.8 9 42.8 9z"></path></svg>
        </button>

        <button 
          onClick={() => {
            if (role === "admin") {
              exportToExcel(adminAttendance, adminData, "Admin_Report");
            } else {
              exportToExcel(employeeAttendance, null, "My_Attendance");
            }
          }} 
          className="px-3 py-1 bg-gray-200 rounded hover:bg-green-100 transition-all border border-transparent hover:border-green-400"
          title="Download Excel"
        >
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 384 512" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm60.1 106.5L224 336l60.1 93.5c5.1 8-.6 18.5-10.1 18.5h-34.9c-4.4 0-8.5-2.4-10.6-6.3C208.9 405.5 192 373 192 373c-6.4 14.8-10 20-36.6 68.8-2.1 3.9-6.1 6.3-10.5 6.3H110c-9.5 0-15.2-10.5-10.1-18.5l60.3-93.5-60.3-93.5c-5.2-8 .6-18.5 10.1-18.5h34.8c4.4 0 8.5 2.4 10.6 6.3 26.1 48.8 20 33.6 36.6 68.5 0 0 6.1-11.7 36.6-68.5 2.1-3.9 6.2-6.3 10.6-6.3H274c9.5-.1 15.2 10.4 10.1 18.4zM384 121.9v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z"></path></svg>
        </button>

        <button className="px-3 py-1 bg-gray-200 rounded hover:bg-white transition-colors" title="Add New">
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z"></path></svg>
        </button>
      </div>
    </div>
  );
};

export default Filters;