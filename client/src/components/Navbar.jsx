import React, { useContext, useEffect, useState } from "react";
import { ChevronDown, LockKeyhole, Menu as MenuIcon } from "lucide-react";
import {
  Avatar,
  Button,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
} from "@mui/material";
import { Person, Logout } from "@mui/icons-material";
import avatarImg from "../assets/avatar.webp";
import { NavLink, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { EmployContext } from "../context/EmployContextProvider";

const Navbar = ({ open, setOpen }) => {
  const [date, setDate] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

    const {profileImage} = useContext(EmployContext)

    useEffect(()=>{
      console.log("profileImage",profileImage);
      
    },[profileImage])

  const openMenu = Boolean(anchorEl);

  useEffect(() => {
    const now = new Date();
  
    const hours24 = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours24 >= 12 ? "PM" : "AM";
  
    const formattedDate = `${now
      .getDate()
      .toString()
      .padStart(2, "0")}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${now.getFullYear()} ${hours24
      .toString()
      .padStart(2, "0")}:${minutes} ${ampm}`;
  
    setDate(formattedDate);
  }, []);
  
  

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logout Successfully");
    navigate("/");
  };

  const getProfileRoute = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.role === "admin"
      ? "/admin/"
      : "/employee/profile";
  };


  useEffect(()=>{
    console.log("profileImage",profileImage);
    
  },[profileImage])

  return (
    <header className="bg-white border-b px-4 py-3 flex items-center justify-between h-14">

  {/* Left: Hamburger */}
  <button
    className="p-2 rounded hover:bg-gray-200/60"
    onClick={() => setOpen(!open)}
  >
    <MenuIcon size={26} />
  </button>

  {/* Center: Title */}
  <h1 className=" w-[70%] text-center text-[28px] font-bold text-[#212e7d] m-0 py-[0.25rem]">
  I-Diligence HR  Application
</h1>

  {/* Right Section */}
  <div className="flex items-center gap-3">

    {/* Date (desktop only) */}
    <span className="hidden md:block text-sm text-gray-500 text-nowrap">
      {date}
    </span>

    {/* Avatar */}
    <div
      className="flex items-center gap-2 cursor-pointer select-none"
      onClick={(e) => setAnchorEl(e.currentTarget)}
    >
      <Avatar src={profileImage ? profileImage: avatarImg} alt="Avatar" className="w-8 h-8" />

      <p className="hidden md:block font-semibold text-nowrap">
        {user?.name}
      </p>

      <ChevronDown
        size={18}
        className={`transition-transform duration-200 ${
          openMenu ? "rotate-180" : ""
        }`}
      />
    </div>

    {/* Dropdown Menu */}
  <Menu
    anchorEl={anchorEl}
    open={openMenu}
    onClose={() => setAnchorEl(null)}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    transformOrigin={{ vertical: "top", horizontal: "right" }}
  >
  {/* User Info */}
  <div className="px-4 py-2">
    <p className="font-semibold ">{user?.name}</p>
    <p className="text-sm text-gray-500">{user?.email}</p>
  </div>

  <Divider />

  {/* My Profile (Admin & Employee) */}
  <MenuItem
    onClick={() => {
      navigate(
        user?.role === "admin"
          ? "/admin/profile"
          : "/employee/profile"
      );
      setAnchorEl(null);
    }}
  >
    <ListItemIcon>
      <Person fontSize="small" />
    </ListItemIcon>
    My Profile
  </MenuItem>

  {/* Change Password (Role Based) */}
  <MenuItem
    onClick={() => {
      navigate(
        user?.role === "admin"
          ? "/admin/change-password"
          : "/employee/change-password"
      );
      setAnchorEl(null);
    }}
  >
    <ListItemIcon>
      <LockKeyhole size={18} />
    </ListItemIcon>
    Change Password
  </MenuItem>

  <Divider />

  {/* Logout */}
  <MenuItem onClick={handleLogout} className="text-red-600">
    <ListItemIcon>
      <Logout fontSize="small" color="error" />
    </ListItemIcon>
    Logout
  </MenuItem>
</Menu>

  </div>
</header>

  );
};

export default Navbar;
