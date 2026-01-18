import { Typography } from "@mui/material";
import AttendanceBarChart from "../charts/AttendanceBarChart";
import Leavecards from "../components/Leavecards";
import MonthlyHolidays from "../components/Monthlyholidays";
import Cards from "../components/Cards";
import profileImg from "../assets/avatar.webp";
import AttendanceDoughnutChart from "../charts/Doughnut";
import { IoPerson, IoExitOutline } from "react-icons/io5";
import { IoEnterOutline } from "react-icons/io5";

import { MdOutlineCoPresent } from "react-icons/md";
import { BsFillPersonXFill } from "react-icons/bs";
import { TbClockX } from "react-icons/tb";
import { FaUserClock } from "react-icons/fa6";
import { SlCalender } from "react-icons/sl";
import { useContext } from "react";
import { EmployContext } from "../context/EmployContextProvider";
import Loader from "../components/Loader";


const Overview = () => {
  const getTime = (dateTime) => {
    if (!dateTime) return "--";
  
    // If already HH:MM
    if (/^\d{2}:\d{2}$/.test(dateTime)) return dateTime;
  
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return "--";
  
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // change to true if you want AM/PM
    });
  };
  

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role?.toLowerCase()?.trim();
  const isAdmin = role === "admin";


  const { singleAttendance,loading } = useContext(EmployContext);

  // console.log(singleAttendance);
  



// take latest attendance (already DESC from backend)
// const latest = attendance.length > 0 ? attendance[0] : null;

const empCardData = singleAttendance
  ? [
      {
        id: 1,
        title: "Punch In asdfa",
        value: singleAttendance.today?.punch_in
          ? getTime(singleAttendance.today.punch_in)
          : "--",
        description: "In Time",
        icon: <IoEnterOutline />,
        bgColor: "#22C55E",
      },
      {
        id: 2,
        title: "Punch Out",
        value: singleAttendance.today?.punch_out
          ? getTime(singleAttendance.today.punch_out)
          : "Working...",
        description: "Out Time",
        icon: <IoExitOutline />,
        bgColor: "#EF4444",
      },
      // {
      //   id: 3,
      //   title: "Today Hours",
      //   value: singleAttendance.today?.total_hours || "00:00",
      //   description: singleAttendance.today?.status,
      //   icon: <TbClockX />,
      //   bgColor: "#F59E0B",
      // },
      {
        id: 3,
        title: "Weekly Hours",
        value: singleAttendance.weekly?.total_hours || "00:00",
        description: "This Week",
        icon: <FaUserClock />,
        bgColor: "#6366F1",
      },
    ]
  : [];


  
  const adminData = [
    { id: 1, title: "Total Employees", total: 15, icon: <IoPerson />, bgColor: "#222f7d" },
    { id: 2, title: "Present Today", total: 9, icon: <MdOutlineCoPresent />, bgColor: "#27F598" },
    { id: 3, title: "Absent Today", total: 6, icon: <BsFillPersonXFill />, bgColor: "#EB1010" },
    { id: 4, title: "Late Check-ins", total: 3, icon: <TbClockX />, bgColor: "#EB9310" },
    { id: 5, title: "On Leave", total: 2, icon: <FaUserClock />, bgColor: "#FACC15" }
  ];

  

  const leaveData = [
    { id: 1, title: "Total Leaves Taken", value: 5, icon: <SlCalender />, bgColor: "#32a852" },
    { id: 2, title: "Leave Requests", value: 2, icon: <SlCalender />, bgColor: "#e8970c" },
    { id: 3, title: "Leaves Allowed", value: 15, icon: <SlCalender />, bgColor: "#e60707" }
  ];

  const holidayList = [
    { id: 1, name: "Christmas Day", date: "25 Dec 2025", month: "December" },
    { id: 2, name: "New Year’s Day", date: "01 Jan 2026", month: "January" },
    { id: 3, name: "Makar Sankranti / Pongal", date: "14 Jan 2026", month: "January" },
    { id: 4, name: "Republic Day", date: "26 Jan 2026", month: "January" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <Loader />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-5">

  {/* Header */}
  <div className=" bg-[#222F7D]  rounded-xl py-2 mb-6 shadow-lg">
    <Typography className="text-white text-2xl sm:text-3xl text-center font-bold tracking-wide">
      Dashboard
    </Typography>
     {/* <Typography className="text-white text-2xl sm:text-3xl text-center font-bold tracking-wide">
     Dashboard
              </Typography> */}
  </div>

    {/* {loading ? <Loader/>:()} */}
  {/* Main Grid */}
  <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

    {/* Left Section */}
    <div className="xl:col-span-3 space-y-6">

      <Cards
        // AdmincardData={adminData}
        // EmploycardData={empCardData}
      />

      {/* Employee Leave Section */}
      {/* {!isAdmin && (
        <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Leave Overview
          </h2>
          <Leavecards LeavecardData={leaveData} />
        </div>
      )} */}

<div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Leave Overview
          </h2>
          <Leavecards LeavecardData={leaveData} />
        </div>
    </div>

    {/* Right Profile Section */}
    {!isAdmin && (
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden transform hover:-translate-y-1 transition-all">

        {/* Cover */}
        <div className="h-24 bg-[#222F7D]" />

        {/* Avatar */}
        <div className="-mt-14 flex justify-center">
          <img
            src={profileImg}
            alt="profile"
            className="w-28 h-28 rounded-full border-4 border-white shadow-lg object-cover"
          />
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6 pt-4 text-center">
          <h3 className="text-xl font-bold text-gray-800">
            {user?.name}
          </h3>

          <span className="inline-block mt-2 px-4 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide">
            {role}
          </span>

          <div className="border-t my-5" />

          <div className="text-sm text-gray-600 space-y-3 text-left">
            <div className="flex justify-between">
              <span className="font-medium">Employee ID</span>
              <span className="font-semibold text-gray-800">
                {user?.emp_id}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="font-medium">Email</span>
              <span className="text-gray-800 truncate max-w-[160px]">
                {user?.email}
              </span>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Admin Stats */}
    {isAdmin && (
      <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          Attendance Statistics
        </h2>

        <div className="flex-1 flex items-center justify-center">
          <AttendanceDoughnutChart cardData={adminData} />
        </div>
      </div>
    )}
  </div>

  {/* Admin Section */}
  {isAdmin && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">

      <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition p-6">
        <h2 className="text-lg font-semibold mb-5 text-gray-800">
          Attendance Exceptions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-xl p-5">
            <p className="text-sm text-gray-500">Late Coming</p>
            <h3 className="text-3xl font-bold text-red-500 mt-1">250</h3>
          </div>

          <div className="bg-orange-50 rounded-xl p-5">
            <p className="text-sm text-gray-500">Early Leaving</p>
            <h3 className="text-3xl font-bold text-orange-500 mt-1">250</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition p-4">
        <AttendanceBarChart cardData={adminData} />
      </div>
    </div>
  )}

  {/* Employee Holidays */}
  {!isAdmin && (
    <div className="mt-8">
      <MonthlyHolidays holidays={holidayList} />
    </div>
  )}
</div>

  );
};

export default Overview;
