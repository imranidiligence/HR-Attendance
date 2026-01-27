import React from "react";
import { NavLink } from "react-router-dom";
import { IoMdSettings } from "react-icons/io";
import { MdOutlineHolidayVillage } from "react-icons/md";
import { SlCalender } from "react-icons/sl";
import { CgProfile } from "react-icons/cg";
import { House, LockKeyhole, BookAIcon, X } from "lucide-react";
import { Tooltip } from "@mui/material";
import logo from "../assets/ids-logo.png"

const EmploySidebar = ({ open, setOpen }) => {
  const navClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2 rounded transition border
     ${isActive
      ? "bg-[#222F7D] text-white"
      : "text-black hover:bg-[#222F7D] hover:text-white border-[#dbdbdb]"
    }`;

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40 bg-white shadow-md
        transform transition-all duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:static md:translate-x-0
        ${open ? "md:w-64" : "md:w-20"}
        flex flex-col
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b h-14 mx-auto my-auto ">
        <button
          onClick={() => setOpen(!open)}
          className="text-lg font-semibold flex justify-center items-center gap-2 mt-4"
        >
          {open ? <img src={logo} className="w-[80px] h-[50px] object-fill"/>: <BookAIcon />}
        </button>

        {/* Close button (mobile only) */}
        <button
          className="md:hidden"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
      </div>

      {/* Menu */}
      <nav className="mt-4 space-y-2 px-4 flex-1 overflow-y-auto">

        <NavLink to="/employee" end className={navClass} 
        // onClick={() => setOpen(false)}
        >
          <House />
          {open && <span className="text-md">My Dashboard</span>}
        </NavLink>

        <NavLink to="/employee/attendance" className={navClass}
        //  onClick={() => setOpen(false)}
         >
          <LockKeyhole />
          {open && <span>My Attendance</span>}
        </NavLink>

        <NavLink to="/employee/profile" className={navClass} 
        // onClick={() => setOpen(false)}
        >
          <CgProfile size={20} />
          {open && <span>My Profile</span>}
        </NavLink>

        <NavLink to="/employee/holidays" className={navClass}
        //  onClick={() => setOpen(false)}
         
         >
          <MdOutlineHolidayVillage size={20} />
          {open && <span>My Holidays</span>}
        </NavLink>

        {/* <NavLink to="/employee/leaves" className={navClass} onClick={() => setOpen(false)}>
          <SlCalender size={20} />
          {open && <span>My Leaves</span>}
        </NavLink> */}
        {/* <NavLink to="/employee/change-password" className={navClass}>
          <LockKeyhole />
          {open && <span>My Change Password</span>}
        </NavLink> */}

        <NavLink
          to="/employee/leaves"
          className={navClass}
          // onClick={() => setOpen(false)}
        >
          <Tooltip
            title="My Leaves"
            placement="right"
            arrow
            disableHoverListener={open}
          >
            <span className="flex items-center justify-center">
             <SlCalender size={20} />
            </span>
          </Tooltip>

          {open && <span>My Leaves</span>}
        </NavLink>


        {/* <NavLink to="/employee/settings" className={navClass} onClick={() => setOpen(false)}>
          <IoMdSettings size={20} />
          {open && <span>Settings</span>}
        </NavLink> */}


        {/*  Settings */}

        {/* <NavLink
          to="/employee/settings"
          className={navClass}
          // onClick={() => setOpen(false)}
        >
          <Tooltip
            title="Settings"
            placement="right"
            arrow
            disableHoverListener={open}
          >
            <span className="flex items-center justify-center">
              <IoMdSettings size={20} />
            </span>
          </Tooltip>

          {open && <span>Settings</span>}
        </NavLink> */}

      </nav>
    </aside>
  );
};

export default EmploySidebar;
