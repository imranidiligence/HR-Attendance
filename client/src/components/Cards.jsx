import React, { useContext, useMemo } from "react";
import { EmployContext } from "../context/EmployContextProvider";
import PeopleIcon from "@mui/icons-material/People";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { IoEnterOutline } from "react-icons/io5";
import { useLocation } from "react-router-dom";
import { BsCalendarWeek } from "react-icons/bs";
import { IoExit } from "react-icons/io5";
import { useEffect } from "react";

const Cards = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isEmployeeDashboard = location.pathname.startsWith("/admin/my-dashboard");
  const isEmployee = location.pathname.startsWith("/employee");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const {
    adminAttendance = [],
    singleAttendance,
    loading,
    auth,
    refreshEmployeeDashboard,
    refreshAdminAttendance,
  } = useContext(EmployContext);
  const role = user?.role?.toLowerCase()?.trim();

  useEffect(() => {
    if (!auth?.token) return;

    if (role === "admin") {
      refreshAdminAttendance();
    } else {
      refreshEmployeeDashboard();
    }
  }, [auth?.token, role]);

  /*Admin Cards - Filtered for active users only */
  const adminCards = useMemo(() => {
    if (!Array.isArray(adminAttendance) || adminAttendance.length === 0) {
      return [];
    }

    // Filter to only include active users
    const activeEmployees = adminAttendance.filter(
      (emp) => emp.is_active === true,
    );

    const totalEmployees = activeEmployees.length;

    const presentToday = activeEmployees.filter(
      (emp) => emp.status === "Present" || emp.status === "Working",
    ).length;

    const absentToday = activeEmployees.filter(
      (emp) => emp.status === "Absent",
    ).length;

    return [
      {
        id: 1,
        title: "Total Employees",
        value: totalEmployees,
        icon: <PeopleIcon />,
        bgColor: "#4F46E5",
      },
      {
        id: 2,
        title: "Present Today",
        value: presentToday,
        icon: <CheckCircleIcon />,
        bgColor: "#16A34A",
      },
      {
        id: 3,
        title: "Absent Today",
        value: absentToday,
        icon: <CancelIcon />,
        bgColor: "#DC2626",
      },
    ];
  }, [adminAttendance]);

  /* Employee Cards */
  const employeeCards = useMemo(() => {
    return [
      {
        id: 1,
        title: "Punch In",
        value: singleAttendance?.today?.punch_in
          ? singleAttendance?.today?.punch_in.split(" ")[0]
          : "--",
        icon: <IoEnterOutline />,
        bgColor: "#32a852",
      },
      {
        id: 2,
        title: "Punch Out",
        value: singleAttendance?.today?.punch_out
          ? singleAttendance?.today?.punch_out.split(" ")[0]
          : "--",
        icon: <IoExit />,
        bgColor: "#dc2626",
      },
      {
        id: 3,
        title: "Total Hours",
        value: singleAttendance?.today?.total_hours ?? "--",
        icon: <CheckCircleIcon />,
        bgColor: "#2563eb",
      },
      {
        id: 4,
        title: "Weekly Hours",
        value: singleAttendance?.weekly?.total_hours ?? "--",
        icon: <BsCalendarWeek />,
        bgColor: "#2563eb",
      },
    ];
  }, [singleAttendance]);

  /*Loading */
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[120px] rounded-xl bg-gray-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const cardsToRender =
    isEmployee || (isAdminRoute && isEmployeeDashboard)
      ? employeeCards
      : isAdminRoute
      ? adminCards
      : [];

  if (!cardsToRender.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-white px-4 py-3 rounded-xl">
      {cardsToRender.map((data) => (
        <div
          key={data.id}
          className="w-full min-h-[120px] rounded-xl bg-white border border-gray-200
                     p-5 shadow-sm flex flex-col justify-between
                     transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
        >
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-lg text-white text-2xl"
              style={{ backgroundColor: data.bgColor }}
            >
              {data.icon}
            </div>

            <div>
              <p className="text-sm text-gray-500">{data.title}</p>
              <p className="text-2xl font-semibold">{data.value ?? "--"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Cards;