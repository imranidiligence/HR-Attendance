import { Typography } from "@mui/material";
import React, { useContext, useMemo } from "react";
import Table from "../components/Table";
import { EmployContext } from "../context/EmployContextProvider";
import Loader from "../components/Loader";
import Filters from "../components/Filters";

/* helper function */
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

const Attendence = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role?.toLowerCase()?.trim();
  const isAdmin = role === "admin";

  const { adminAttendance = [], loading } = useContext(EmployContext);

  /* Headers */
  const adminTableHeader = [
    "Sr.No",
    "Emp ID",
    "Employee Name",
    "Date",
    "Punch In",
    "Punch Out",
    "Status",
    "Expected Hours",
    "Actual Working Hours",
  ];

  const employeeTableHeader = [
    "Emp ID",
    "Employee Name",
    "Date",
    "Status",
    "Punch In",
    "Punch Out",
    "Actual Working Hours",
    "Expected Hours",
  ];

  /* Data */
  const adminTableData = useMemo(
    () =>
      adminAttendance.map((item, index) => ({
        srNo: index + 1,
        empId: item.device_user_id || item.emp_id,
        name: item.name,
        date: item.attendance_date,
        punchIn: item.punch_in || "--",
        punchOut: item.punch_out || "--",
        status: item.status,
        expectedHours: formatHours(item.expected_hours),
        workingHours: formatHours(item.total_hours),
      })),
    [adminAttendance]
  );

  const employeeTableData = useMemo(
    () =>
      adminAttendance.map((item) => ({
        empId: item.device_user_id || item.emp_id,
        name: item.name,
        date: item.attendance_date,
        status: item.status,
        punchIn: item.punch_in || "--",
        punchOut: item.punch_out || "--",
        workingHours: formatHours(item.total_hours),
        expectedHours: formatHours(item.expected_hours),
      })),
    [adminAttendance]
  );

  const handleFilterClick = ()=>{

  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-3 pb-6">

      {/* Header */}
      {!isAdmin && 
      <div className="sticky top-0 z-0 bg-[#222F7D] rounded-lg">
        <Typography className="text-white py-2 text-2xl text-center">
          Attendance
        </Typography>
      </div>
      }

      {/* Loader */}
      {loading ? (
        <div className="flex items-center justify-center h-[70vh]">
          <Loader />
        </div>
      ) : (
        <div className="mt-4">
          <Filters filterClick={handleFilterClick}/>
         
          {
            <Table
            headers={isAdmin ? adminTableHeader : employeeTableHeader}
            data={isAdmin ? adminTableData : employeeTableData}
            filterClick={handleFilterClick}
          /> }
        </div>
      )}
    </div>
  );
};

export default Attendence;
