import React, { useContext, useEffect, useMemo } from "react";
import { Typography } from "@mui/material";
import { useLocation } from "react-router-dom";

// Icons
import { IoPerson } from "react-icons/io5";
import { MdOutlineCoPresent } from "react-icons/md";
import { BsFillPersonXFill } from "react-icons/bs";
import { TbClockX } from "react-icons/tb";
import { FaUserClock } from "react-icons/fa6";
import { SlCalender } from "react-icons/sl";

// Components
import AttendanceBarChart from "../charts/AttendanceBarChart";
import Leavecards from "../components/Leavecards";
import MonthlyHolidays from "../components/Monthlyholidays";
import Cards from "../components/Cards";
import AttendanceDoughnutChart from "../charts/Doughnut";
import Loader from "../components/Loader";
import avatarImg from "../assets/avatar.webp";

// Context
import { EmployContext } from "../context/EmployContextProvider";
import api from "../../api/axiosInstance";

const Overview = () => {
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role?.toLowerCase()?.trim();

  const {
    profileImage,
    setProfileImage,
    token,
    loading,
    adminAttendance = [],
  } = useContext(EmployContext);

  const BASE_URL = import.meta.env.VITE_DOC;

  // Detect Routes
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isEmployeeDashboard = location.pathname.startsWith("/admin/my-dashboard");
  const isEmployee = location.pathname.startsWith("/employee");

  useEffect(() => {
    const fetchProfileImage = async () => {
      try {
        const res = await api.get("employee/profile/image", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data?.profile_image) {
          setProfileImage(`${res.data.profile_image}?t=${new Date().getTime()}`);
        } else {
          setProfileImage(avatarImg);
        }
      } catch (error) {
        console.error("Error fetching profile image:", error);
        if (!profileImage) setProfileImage(avatarImg);
      }
    };

    if (token) fetchProfileImage();
  }, [token, setProfileImage]);

  // Filter active employees and create adminData dynamically
  const adminData = useMemo(() => {
    // Filter to only include active users
    const activeEmployees = adminAttendance.filter(
      (emp) => emp.is_active === true,
    );

    const total = activeEmployees.length;
    const present = activeEmployees.filter(
      (emp) => emp.status === "Present" || emp.status === "Working"
    ).length;
    const absent = activeEmployees.filter(
      (emp) => emp.status === "Absent"
    ).length;
    
    // Calculate late check-ins 
    const late = activeEmployees.filter(
      (emp) => emp.status === "Late" || (emp.punch_in && new Date(emp.punch_in).getHours() >= 9)
    ).length;
    
    // Calculate on leave
    const onLeave = activeEmployees.filter(
      (emp) => emp.status === "Leave" || emp.status === "On Leave"
    ).length;

    return [
      { 
        id: 1, 
        title: "Total Employees", 
        total, 
        icon: <IoPerson />, 
        bgColor: "#222f7d" 
      },
      { 
        id: 2, 
        title: "Present Today", 
        total: present, 
        icon: <MdOutlineCoPresent />, 
        bgColor: "#27F598" 
      },
      { 
        id: 3, 
        title: "Absent Today", 
        total: absent, 
        icon: <BsFillPersonXFill />, 
        bgColor: "#EB1010" 
      },
      { 
        id: 4, 
        title: "Late Check-ins", 
        total: late, 
        icon: <TbClockX />, 
        bgColor: "#EB9310" 
      },
      { 
        id: 5, 
        title: "On Leave", 
        total: onLeave, 
        icon: <FaUserClock />, 
        bgColor: "#FACC15" 
      }
    ];
  }, [adminAttendance]);

  // Static leave data 
  const leaveData = [
    { id: 1, title: "Total Leaves Allowed", value: 15, icon: <SlCalender />, bgColor: "#4f46e5" },
    { id: 2, title: "Total Leaves Taken", value: 5, icon: <SlCalender />, bgColor: "#32a852" },
    { id: 3, title: "Leave Requests", value: 2, icon: <SlCalender />, bgColor: "#e8970c" }
  ];

  const holidayList = [
    { id: 1, name: "Christmas Day", date: "25 Dec 2025", month: "December" },
    { id: 2, name: "New Year's Day", date: "01 Jan 2026", month: "January" },
    { id: 3, name: "Makar Sankranti", date: "14 Jan 2026", month: "January" },
    { id: 4, name: "Republic Day", date: "26 Jan 2026", month: "January" }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:px-3">
      {/* HEADER */}
      <div className={`sticky z-20 top-2 bg-[#222F7D] rounded-xl py-3 mb-6 shadow-lg flex justify-center items-center px-6 h-[40px] ${
        location.pathname === "/employee" ? "mt-1" : "-mt-[5px]"
      }`}>
        <Typography className="text-white text-2xl text-center font-bold tracking-wide">
          Dashboard
        </Typography>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* LEFT CONTENT */}
        <div className="xl:col-span-3 space-y-6">
          <Cards />

          <div className="bg-white rounded-2xl shadow-md p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Leave Overview
            </h2>
            <Leavecards LeavecardData={leaveData} />
          </div>
        </div>

        {/* RIGHT PANEL - Profile Card */}
        {isEmployeeDashboard || isEmployee ? (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden h-[370px]">
            <div className="h-24 bg-[#222F7D]" />

            <div className="-mt-14 flex justify-center">
              <img
                src={
                  user.profile_image
                    ? `${BASE_URL}${user.profile_image}`
                    : avatarImg
                }
                alt="profile"
                className="w-28 h-28 rounded-full border-4 border-white shadow-lg object-cover"
              />
            </div>

            <div className="px-6 pb-6 pt-4 text-center">
              <h3 className="text-xl font-bold text-gray-800">
                {user?.name || "Employee"}
              </h3>

              <span className="inline-block mt-2 px-4 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 uppercase">
                {role}
              </span>

              <div className="border-t my-5" />

              <div className="text-sm text-gray-600 space-y-3 text-left">
                <div className="flex justify-between">
                  <span>Employee ID</span>
                  <span className="font-semibold text-gray-800">
                    {user?.emp_id}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Email</span>
                  <span className="text-gray-800 truncate max-w-[160px]">
                    {user?.email}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* RIGHT PANEL - Pie Chart (only for admin routes) */}
        {!isEmployeeDashboard && !isEmployee && adminAttendance.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              Attendance Statistics
            </h2>

            <div className="flex-1 flex items-center justify-center">
              <AttendanceDoughnutChart cardData={adminData} />
            </div>
          </div>
        ) : null}
      </div>

      {/* ADMIN ANALYTICS - Attendance Exceptions & Bar Chart */}
      {!isEmployeeDashboard && !isEmployee && adminAttendance.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-lg font-semibold mb-5 text-gray-800">
              Attendance Exceptions
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-xl p-5">
                <p className="text-sm text-gray-500">Late Coming</p>
                <h3 className="text-3xl font-bold text-red-500 mt-1">
                  {adminData.find(item => item.title === "Late Check-ins")?.total || 0}
                </h3>
              </div>

              <div className="bg-orange-50 rounded-xl p-5">
                <p className="text-sm text-gray-500">Early Leaving</p>
                <h3 className="text-3xl font-bold text-orange-500 mt-1">4</h3>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4">
            <AttendanceBarChart cardData={adminData} />
          </div>
        </div>
      ) : null}

      {/* HOLIDAYS - Employee Dashboard */}
      {isEmployeeDashboard || isEmployee ? (
        <div className="mt-8">
          <MonthlyHolidays holidays={holidayList} />
        </div>
      ) : null}
    </div>
  );
};

export default Overview;