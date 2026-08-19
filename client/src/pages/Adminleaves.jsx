// import React, { useState, useEffect, useCallback } from "react";
// import { Typography } from "@mui/material";
// import { FaCalendarCheck, FaRegClock, FaCheckCircle, FaCalendarAlt } from "react-icons/fa";
// import { TfiMenuAlt } from "react-icons/tfi";

// // Components
// import Leavecards from "../components/Leavecards";
// import Loader from "../components/Loader";
// import PendingLeavesTable from "../components/PendingLeaves";
// import LeaveHistoryTable from "../components/LeaveHistoryTable";

// // API & Hooks
// import api from "../../api/axiosInstance";
// import useSocket from "../custom/useSocket"; // Custom hook for real-time updates

// const Adminleaves = () => {
//   const [activeTab, setActiveTab] = useState("pending");
//   const [leaveTableData, setLeaveTableData] = useState([]);
//   const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, month: 0 });
//   const [loading, setLoading] = useState(true);

//   // Get current logged-in Admin/Manager ID
//   const managerId = localStorage.getItem("emp_id");

//   /**
//    * Fetch Data Function
//    * Wrapped in useCallback so it can be passed safely to useSocket and useEffect
//    */
//   const fetchAdminData = useCallback(async () => {
//     if (!managerId) return;
    
//     setLoading(true);
//     try {
//       // Fetch Leaves pending for THIS manager
//       const response = await api.get(`leaves/pending-approvals/${managerId}`);
//       const allData = response.data;
//       setLeaveTableData(allData);

//       // Calculate Stats
//       const pending = allData.filter(l => l.status === 'pending').length;
//       const approved = allData.filter(l => l.status === 'approved').length;
//       const currentMonth = new Date().getMonth();

//       setStats({
//         total: allData.length,
//         pending: pending,
//         approved: approved,
//         month: allData.filter(l => new Date(l.applied_at).getMonth() === currentMonth).length
//       });

//     } catch (error) {
//       console.error("Failed to fetch admin leave data", error);
//     } finally {
//       setLoading(false);
//     }
//   }, [managerId]);

//   // --- REAL-TIME INTEGRATION ---
//   // Listens for 'NEW_LEAVE_REQUEST' and triggers fetchAdminData automatically
//   useSocket(managerId, fetchAdminData);

//   useEffect(() => {
//     fetchAdminData();
//   }, [fetchAdminData]);

//   /**
//    * Filter Logic
//    * In a real app, 'history' might fetch different data, 
//    * but here we filter the local state for speed.
//    */
//   const filteredLeaves = leaveTableData.filter((item) => {
//     if (activeTab === "pending") return item.status === "pending";
//     if (activeTab === "history") return item.status !== "pending"; // Approved/Rejected
//     return true;
//   });

//   const adminLeaveCards = [
//     { id: 1, request: "Total Request", total: stats.total, icon: <FaCalendarCheck />, bgColor: "#0e6efe" },
//     { id: 2, request: "Pending", total: stats.pending, icon: <FaRegClock />, bgColor: "#FFC107" },
//     { id: 3, request: "Approved", total: stats.approved, icon: <FaCheckCircle />, bgColor: "#1A8755" },
//     { id: 4, request: "This Month", total: stats.month, icon: <FaCalendarAlt />, bgColor: "#0EC9F0" }
//   ];

//   // if (loading) return (
//   //   <div className="flex items-center justify-center h-[70vh]">
//   //     <Loader />
//   //   </div>
//   // );

//   return (
//     <div className="px-3 pb-6">
//       {/* Header */}
//       <div className="sticky top-0 z-50 bg-[#222F7D] rounded-lg mt-[8px]">
//         <Typography className="text-white py-2 text-2xl text-center">
//           Leave Requests
//         </Typography>
//       </div>

//       <h1 className="text-lg mt-4 py-1 font-semibold">Manager Dashboard</h1>

//       {/* Stats Cards */}
//       <Leavecards LeavecardData={adminLeaveCards} />

//       {/* Tab Navigation */}
//       <div className="flex items-center gap-4 w-full px-3 py-2 mt-4">
//         {/* Pending Tab */}
//         <div
//           onClick={() => setActiveTab("pending")}
//           className={`px-4 py-2 rounded-md cursor-pointer relative transition-all ${
//             activeTab === "pending" 
//               ? "bg-[#1a8755] text-white shadow-md" 
//               : "bg-[#1a8755] bg-opacity-10 text-[#1a8755] border border-[#1a8755]"
//           }`}
//         >
//           <p className="flex items-center gap-2">
//             <FaRegClock />
//             <span>Pending Approvals</span>
//           </p>
//           {stats.pending > 0 && (
//             <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 text-xs rounded-full flex items-center justify-center animate-pulse">
//               {stats.pending}
//             </span>
//           )}
//         </div>

//         {/* History Tab */}
//         <div
//           onClick={() => setActiveTab("history")}
//           className={`px-4 py-2 rounded-md flex items-center gap-2 cursor-pointer transition-all ${
//             activeTab === "history" 
//               ? "bg-[#1a8755] text-white shadow-md" 
//               : "text-[#1a8755] border bg-[#1a8755] bg-opacity-10 border-[#1a8755]"
//           }`}
//         >
//           <TfiMenuAlt />
//           <span>History</span>
//         </div>
//       </div>

//       {/* Content Area */}
//       <div className="mt-6">
//         {activeTab === "pending" ? (
//           <PendingLeavesTable 
//             pendingLeave={filteredLeaves} 
//             refreshData={fetchAdminData} 
//           />
//         ) : (
//           <LeaveHistoryTable 
//             historyData={filteredLeaves} // Assuming this component handles history
//           />
//         )}
//       </div>
//     </div>
//   );
// };

// export default Adminleaves;



import React, { useState, useEffect, useCallback } from "react";
import { Typography } from "@mui/material";
import { FaCalendarCheck, FaRegClock, FaCheckCircle, FaCalendarAlt } from "react-icons/fa";
import { TfiMenuAlt } from "react-icons/tfi";

// Components
import Leavecards from "../components/Leavecards";
import Loader from "../components/Loader";
import PendingLeavesTable from "../components/PendingLeaves";
import LeaveHistoryTable from "../components/LeaveHistoryTable";

// API & Hooks
import api from "../../api/axiosInstance";
import useSocket from "../custom/useSocket"; // Custom hook for real-time updates

const Adminleaves = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [leaveTableData, setLeaveTableData] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, month: 0 });
  const [loading, setLoading] = useState(true);
  const[leaveCount,setLeaveCount] = useState([]);

  // Get current logged-in Manager ID from storage
  const managerId = localStorage.getItem("emp_id");

  /**
   * Fetch Data Function
   * Fetches all leaves relevant to this manager and updates the statistics.
   */
  const fetchAdminData = useCallback(async (isSilent = false) => {
    if (!managerId) return;
    
    // If it's a silent refresh (from socket), don't show the big spinner
    if (!isSilent) setLoading(true);

    try {
      const response = await api.get(`leaves/pending-approvals/${managerId}`);
      const allData = response.data;
      
      setLeaveTableData(allData);

      // Recalculate Statistics
      const pendingCount = allData.filter(l => l.status === 'pending').length;
      const approvedCount = allData.filter(l => l.status === 'approved').length;
      const currentMonth = new Date().getMonth();

      setStats({
        total: allData.length,
        pending: pendingCount,
        approved: approvedCount,
        month: allData.filter(l => new Date(l.applied_at).getMonth() === currentMonth).length
      });

    } catch (error) {
      console.error("Error loading admin dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  // --- REAL-TIME NOTIFICATION HUB ---
  // When 'NEW_LEAVE_REQUEST' hits the socket, this triggers fetchAdminData(true)
  useSocket(managerId, () => fetchAdminData(true));

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  /**
   * Data Filtering Logic
   * 'Pending' tab shows only pending items.
   * 'History' tab shows everything that has been processed (Approved/Rejected).
   */
  const filteredLeaves = leaveTableData.filter((item) => {
    if (activeTab === "pending") return item.status === "pending";
    if (activeTab === "history") return item.status !== "pending";
    return true;
  });

  const adminLeaveCards = [
    { id: 1, request: "Total Requests", total: stats.total, icon: <FaCalendarCheck />, bgColor: "#0e6efe" },
    { id: 2, request: "Pending", total: stats.pending, icon: <FaRegClock />, bgColor: "#FFC107" },
    { id: 3, request: "Approved", total: stats.approved, icon: <FaCheckCircle />, bgColor: "#1A8755" },
    { id: 4, request: "This Month", total: stats.month, icon: <FaCalendarAlt />, bgColor: "#0EC9F0" }
  ];

  // if (loading && leaveTableData.length === 0) {
  //   return (
  //     <div className="flex items-center justify-center h-[70vh]">
  //       <Loader />
  //     </div>
  //   );
  // }

  // useEffect(()=>{
  //   console.log("filteredLeaves",filteredLeaves);
  // },[filteredLeaves]);

  const handlePendingLeaves = (data)=>{
      // console.log("data from AdminLeaves",data);

    setLeaveCount(data);

    

  }

  return (
    <div className="px-3 pb-6 animate-fadeIn">
      {/* Blue Sticky Header */}
      <div className="sticky top-0 z-50 bg-[#222F7D] rounded-lg mt-2 shadow-lg">
        <Typography className="text-white py-3 text-2xl text-center font-bold">
          Leave Management
        </Typography>
      </div>
{/* 
      <div className="flex justify-between items-center mt-6">
        <h1 className="text-xl font-bold text-gray-700">Managerial Dashboard</h1>
        <span className="text-sm text-gray-500 italic">Logged in as: {managerId}</span>
      </div> */}

      {/* Top Stats Overview */}
      <div className="mt-4">
        <Leavecards LeavecardData={adminLeaveCards} />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 w-full px-2 py-4 mt-4 border-b border-gray-200">
        
        {/* Pending Tab with Notification Badge */}
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-5 py-2.5 rounded-lg flex items-center gap-2 relative transition-all duration-300 font-medium ${
            activeTab === "pending" 
              ? "bg-[#1a8755] text-white shadow-lg scale-105" 
              : "bg-white text-[#1a8755] border border-[#1a8755] hover:bg-green-50"
          }`}
        >
          <FaRegClock />
          <span>Pending Approvals</span>
           {/* {leaveCount.length} */}
          {leaveCount.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-transparent text-white w-6 h-6 text-xs font-bold rounded-full flex items-center justify-center border-2 border-transparent animate-pulse">
              {/* {leaveCount.length} */}
            </span>
          )}
        </button>

        {/* History Tab */}
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all duration-300 font-medium ${
            activeTab === "history" 
              ? "bg-[#1a8755] text-white shadow-lg scale-105" 
              : "bg-white text-[#1a8755] border border-[#1a8755] hover:bg-green-50"
          }`}
        >
          <TfiMenuAlt />
          <span>Leave History</span>
        </button>
      </div>

      {/* Dynamic Table Content */}
      {/* <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === "pending" ? (
          <PendingLeavesTable 
            pendingLeave={filteredLeaves} 
            refreshData={() => fetchAdminData(true)} // Passes silent refresh to children
            handlePendingLeaves={handlePendingLeaves}
          />
        ) : (
          <LeaveHistoryTable 
            historyData={filteredLeaves} 
          />
        )}
      </div> */}

      {/* Empty State */}
      {!loading && filteredLeaves.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No {activeTab} leave records found.</p>
        </div>
      )}
    </div>
  );
};

export default Adminleaves;