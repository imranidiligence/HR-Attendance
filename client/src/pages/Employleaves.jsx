import { Typography } from "@mui/material";
import React, { useState, useEffect, useCallback } from "react";
import Leavecards from "../components/Leavecards";
import { SlCalender } from "react-icons/sl";
import LeavesTable from "../components/LeavesTable";
import {
  FaCalendarCheck,
  FaCheckCircle,
  FaHourglassHalf,
  FaPlusCircle,
} from "react-icons/fa";
import Modal from "../components/Modal";
import api from "../../api/axiosInstance";

const Employleaves = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaveTableData, setLeaveTableData] = useState([]);
  const [leaveCardData, setLeaveCardData] = useState([]);
  const [loading, setLoading] = useState(true);

  //  USER DATA
  const user = JSON.parse(localStorage.getItem("user"));
  const empId = user?.emp_id;
  const role = user?.role;

  //  ONLY TEAM LEAD CHECK
  const [isManager, setIsManager] = useState(false);


  //  EMPLOYEE DATA
 
  const fetchEmployeeData = async () => {
    try {
      setLoading(true);

      // Leave balance cards
      const res = await api.get(`/leaves/types/balance/${empId}`);
      const data = res.data;
      
      // console.log("Data Summay for cards",data.summary);
      
      const mappedCards = [
        {
          id: 1,
          title: "Total Allowed",
          value: `${data.summary.total} Days`,
          icon: <FaCalendarCheck />,
          bgColor: "#32a852",
        },
        {
          id: 2,
          title: "Total Taken",
          value: `${data.summary.used} Days`,
          icon: <FaCheckCircle />,
          bgColor: "#e8970c",
        },
        {
          id: 3,
          title: "Available Balance",
          value: `${data.summary.remaining} Days`,
          icon: <SlCalender />,
          bgColor: "#1a8755",
        },
        {
          id: 4,
          title: "Pending Requests",
          value: data.summary.pending,
          icon: <FaHourglassHalf />,
          bgColor: "#e60707",
        },
      ];

      setLeaveCardData(mappedCards);

      // My leaves
      const historyRes = await api.get(`/leaves/types/my/${empId}`);
      setLeaveTableData(historyRes.data);
    } catch (err) {
      console.error("Error fetching employee data:", err);
    } finally {
      setLoading(false);
    }
  };


  // TEAM LEAD DATA

  const fetchManagerData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get(
        `/leaves/types/pending-approvals/${empId}`
      );


      // console.log("Pending Approvals:", res.data);

      res.data.forEach((leave) => leave.approver_emp_id === empId && setIsManager(true));
      setLeaveTableData(res.data);
    } catch (error) {
      console.error("Error fetching manager data:", error);
    } finally {
      setLoading(false);
    }
  }, [empId]);

  useEffect(() => {
    fetchManagerData()
  },[])


  useEffect(() => {
    if (!empId) return;

    if (isManager) {
      fetchManagerData();
    } else {
      fetchEmployeeData();
    }
  }, [empId, isManager, fetchManagerData]);

  const leavesTableHeader = [
    "Applied On",
    "Period",
    "Days",
    "Type",
    "Status",
    "Remarks/Reason",
  ];

  const managerLeavesHeader = [
    "Employee",
    "Period",
    "Days",
    "Type",
    "Reason",
    "Current Level",
    "Actions",
  ];

  return (
    <div className="px-3 pb-6">
      {/* HEADER */}
      <div className="sticky z-20 top-4 bg-[#222F7D] rounded-xl py-3 mb-6 shadow-lg flex justify-center items-center px-6 h-[40px] -mt-2">
        <Typography className="text-white text-2xl text-center font-bold tracking-wide">
          Leaves
        </Typography>
      </div>

      <h1 className="text-lg py-2">Leave Management</h1>

      {/*  ONLY EMPLOYEE SEE CARDS */}
    <Leavecards LeavecardData={leaveCardData} />

      {/* TABLE */}
      <div className="bg-slate-50 w-full py-3 mb-4">
        <div className="flex items-center justify-between w-full py-2">
          <h1>
            {isManager ? "Pending Approvals" : "My Leave Requests"}
          </h1>

          {/*  ONLY EMPLOYEE CAN APPLY */}
          {/* {!isManager && ( */}
            <div
              className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-slate-50 hover:text-blue-500 cursor-pointer"
              onClick={() => setIsModalOpen(true)}
            >
              <FaPlusCircle />
              <button>Request New Leave</button>
            </div>
          {/* )} */}
        </div>

        {/* MODAL */}
        <Modal
          isOpen={isModalOpen}
          setisOpen={setIsModalOpen}
          refreshData={isManager ? fetchManagerData : fetchEmployeeData}
        />

        {/* TABLE */}
        {/* <LeavesTable
          leavesHeader={leavesTableHeader}
          leavesBody={leaveTableData}
          adminLeavesHeader={managerLeavesHeader}
          adminLeavesBody={leaveTableData}
          refreshData={isManager ? fetchManagerData : fetchEmployeeData}
          isManager={isManager}
        /> */}
      </div>
    </div>
  );
};

export default Employleaves;