import React, { useState,useEffect, useContext } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import EmploySidebar from "../components/EmploySidebar";
import axios from "axios";
import { EmployContext } from "../context/EmployContextProvider";

const Employlayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = JSON.parse(localStorage.getItem("user")).role;
  const{isMyDash} = useContext(EmployContext);
  
  const isAdmin = role === "admin" ? true:false;
  // console.log("isAdmin",isAdmin)
  
  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

    {/* Sidebar */}
      {
        // isMyDash &&
        !isAdmin && 
      <EmploySidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      }

      {/* Main Content */}
      <div className="flex flex-1 overflow-y-auto overflow-x-hidden flex-col min-w-0 ">
          {
        // isMyDash &&
        !isAdmin &&
   <Navbar open={sidebarOpen} setOpen={setSidebarOpen} />
      }

        <main className="flex-1  p-3 sm:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Employlayout;
