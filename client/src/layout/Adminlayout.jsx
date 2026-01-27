import { NavLink,Outlet } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import Navbar from "../components/Navbar";
import { useState,useEffect } from "react";
import axios from "axios";


function Adminlayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
      const syncAndLoad = async () => {
        try {
          //  Sync attendance
          await axios.get("http://localhost:5000/api/admin/attendance/sync");
    
          // Load today's attendance
          await axios.get("http://localhost:5000//api/admin/attendance/today");
        } catch (err) {
          console.error("Admin sync error", err);
        }
      };
    
      syncAndLoad();
    }, []);
    
  return (
    <div className="flex h-screen overflow-hidden bg-white">
    {/* Sidebar */}
    <AdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
  
    {/* Main Content Wrapper */}
    <div className="flex flex-1 flex-col min-w-0 ">
      
      {/* Navbar */}
      <Navbar setOpen={setSidebarOpen} open={sidebarOpen} />
  
      {/* Page Content (Outlet) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden py-2 ">
        <Outlet />
      </main>

      {/* <footer>IDilligence Solution</footer> */}
  
    </div>
  </div>

  );
}

export default Adminlayout

