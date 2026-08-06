import React, { useEffect, useState } from "react";
import api from "../../api/axiosInstance";
import axios from "axios";

export default function PendingLeavesTable({handlePendingLeaves}) {

  const [pendingLeave, setPendingLeave] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user"));
  const emp_Id = user?.emp_id;

//   console.log("empId leaves",user)

    const getPendingLeaves = async () => {
      try {
        const resp = await axios.get(`http://localhost:5000/api/leaves/types/pending-approvals/${emp_Id}`);

        // console.log("Leave Pending",resp.data)
        setPendingLeave(resp.data);
        handlePendingLeaves(resp.data);

      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

 

  useEffect(() => {
     getPendingLeaves();
  }, []);

  // useEffect(()=>{
  //   console.log("pendingLeaves PendingComponent",pendingLeave)
  // },[]);

  const handleApprove =async(id)=>{

const updatedList = pendingLeave.filter(l => l.approval_id !== id);
// setPendingLeave(prev => prev.filter(l => l.approval_id !== id));
      setPendingLeave(updatedList);
      
      handlePendingLeaves(updatedList);
      // console.log("Leave id",id)
    try {
        const resp = await api.put(`leaves/types/approve/${id}`,{
        status: "approved",
        remarks: "Approved by Admin"
      });
        
        // console.log(resp)
    } catch (error) {
        console.log(error)
    }

  }

  useEffect(()=>{
    // console.log("pendingLeave",pendingLeave)
  },[pendingLeave]);


const handleReject = async(id)=>{
  // setPendingLeave(prev => prev.filter(l => l.approval_id !== id));
    const updatedList = pendingLeave.filter(l => l.approval_id !== id);
    setPendingLeave(updatedList);
    
    // 2. Notify the parent immediately
    handlePendingLeaves(updatedList);
      // console.log("Leave id",id)
    try {
        const resp = await api.put(`leaves/types/approve/${id}`,{
        status: "rejected",
        remarks: "Rejected by Admin"
      });
        
        // console.log(resp)
    } catch (error) {
        console.log(error)
    }
}
  return (
    <div className="bg-white shadow-md rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Pending Leave Requests</h2>

      <table className="w-full border border-gray-200">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Employee</th>
            <th className="p-2 border">Leave Type</th>
            <th className="p-2 border">Start Date</th>
            <th className="p-2 border">End Date</th>
            <th className="p-2 border">Days</th>
            <th className="p-2 border">Reason</th>
            <th className="p-2 border">Approver Role</th>
              <th className="p-2 border">Actions</th>
              <th>Remark</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan="7" className="text-center p-4">
                Loading pending leaves...
              </td>
            </tr>
          ) : pendingLeave.length > 0 ? (
            pendingLeave.map((leave) => (
              <tr key={leave.approval_id} className="hover:bg-gray-50">
                <td className="p-2 border">
                  {leave.employee_name} ({leave.employee_code})
                </td>
                <td className="p-2 border">{leave.leave_type}</td>
                <td className="p-2 border">{leave.start_date}</td>
                <td className="p-2 border">{leave.end_date}</td>
                <td className="p-2 border">{leave.total_days}</td>
                <td className="p-2 border">{leave.reason}</td>
                <td className="p-2 border text-yellow-600 font-semibold">
                  {leave.approver_role}
                </td>
                <td className="p-2 border flex gap-2">

  <button
    onClick={() => handleApprove(leave.approval_id)}
    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
  >
    Approve
  </button>

  <button
    onClick={() => handleReject(leave.approval_id)}
    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
  >
    Reject
  </button>

</td>

<td  contenteditable="true" className="p-2 border">

</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center p-4 text-gray-500">
                No Pending Leave Requests
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}