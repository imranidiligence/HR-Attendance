import React, { useContext, useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { IoMdRefreshCircle } from "react-icons/io";
import { useParams } from "react-router-dom";
import { EmployContext } from "../context/EmployContextProvider";
import api from "../../api/axiosInstance";
import { updatePersonal } from "../../api/profile";
import MainProfile from "../profile/MainProfile";
import { Typography, Divider } from "@mui/material";
import { MdOutlineEmail } from "react-icons/md";
import { IoHomeSharp } from "react-icons/io5";
import ReportingCard from "../components/ReportingCard";

import defaultProfile from "../assets/avatar.webp";
import Loader from "./Loader";

const EmployeeDetails = () => {
  // 1. Get emp_id from URL (for Admin view)
  const { emp_id: urlEmpId } = useParams();

  // ===== Header Data States =====
  const [profileImage, setProfileImage] = useState("");
  const [reporting, setReporting] = useState([]);
  const [employeeBasic, setEmployeeBasic] = useState({});

  /* ================= FETCH FUNCTIONS ================= */

  // console.log("urlEmpId",urlEmpId)

  // 2. Get logged-in user info from localStorage
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const token = localStorage.getItem("token");

  // Logic: Use URL ID if available (Admin viewing someone), otherwise use own ID (Self Profile)
  const emp_id = urlEmpId || user.emp_id;
  const isAdmin = user.role === "admin";

  const { setAdminAttendance,personalAddress } = useContext(EmployContext);

  useEffect(()=>{
    // console.log("personalAddress",personalAddress)
  },[personalAddress])
  // --- State Management ---
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [personal, setPersonal] = useState({});
  const [contact, setContact] = useState([]);
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const[nominee,setNominee] = useState([]);
  const [bank, setBank] = useState([]);
  const [documents, setDocuments] = useState({});

  const isActive = personal.is_active ?? true;

  // --- Data Fetching ---

  const fetchProfileImage = useCallback(async () => {
    try {
      if (!token || !emp_id) return;

      const res = await api.get(`employee/profile/image/${emp_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });


      if (res.data?.profile_image) {
        setProfileImage(`${res.data.profile_image}?t=${Date.now()}`);
      }
    } catch (error) {
      console.error("Error fetching image:", error);
    }
  }, [token, emp_id]);

  const fetchReporting = useCallback(async () => {
    try {
      const res = await api.get(`employees/reporting/${emp_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReporting(res.data.managers || []);
    } catch (error) {
      console.error("Failed to fetch reporting managers", error);
    }
  }, [emp_id, token]);

  const fetchAllData = useCallback(async () => {
    if (!emp_id) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
     const [pRes, cRes, eRes, exRes, bRes, dRes, nRes] =
  await Promise.allSettled([
    api.get(`employee/profile/personal/${emp_id}`, { headers }),
    api.get(`employee/profile/contact/${emp_id}`, { headers }),
    api.get(`employee/profile/education/${emp_id}`, { headers }),
    api.get(`employee/profile/experience/${emp_id}`, { headers }),
    api.get(`employee/profile/bank/${emp_id}`, { headers }),
    api.get(`employee/profile/bank/doc/${emp_id}`, { headers }),
    api.get(`employee/profile/nominee/${emp_id}`, { headers }),   ]);

      if (pRes.status === "fulfilled") setPersonal(pRes.value.data || {});
      if (cRes.status === "fulfilled")
        setContact(cRes.value.data?.contacts || []);
      if (eRes.status === "fulfilled")
        setEducation(eRes.value.data?.education || []);
      if (exRes.status === "fulfilled")
        setExperience(exRes.value.data?.experience || []);

      if(nRes.status === "fulfilled")
        setNominee(nRes.value.data?.nominee ||[]);

      // console.log("bRes",bRes);
      if (bRes.status === "fulfilled")
        setBank(bRes.value.data?.bankDetails || []);


      // console.log("dRes",dRes);

      if (dRes?.status === "fulfilled") {
        const docObj = {};
        (dRes.value.data?.documents || []).forEach((d) => {
          docObj[d.file_type] = d.file_path;
        });
        setDocuments(docObj);
      }
    } catch (err) {
      // console.log("error employData",err);
      toast.error("Error fetching employee data");
    } finally {
      setLoading(false);
    }
  }, [emp_id, token]);

  useEffect(()=>{

    // console.log("setNominee",nominee);

  },[])

  useEffect(() => {
    if (personal) {
      setEmployeeBasic({
        name: personal.name,
        role: personal.role,
        email: personal.email,
        address: personal.address,
      });
    }
  }, [personal]);

  useEffect(() => {
    fetchAllData();
    fetchProfileImage();
    fetchReporting();
  }, [fetchAllData, fetchProfileImage, fetchReporting,refreshTrigger]);

  // --- Handlers ---
  // const handleToggleActive = async () => {
  //   if (!isAdmin || isToggling) return;
  //   try {
  //     setIsToggling(true);
  //     const newStatus = !isActive;
  //     await api.patch(
  //       `/admin/attendance/${emp_id}/status`,
  //       { is_active: newStatus },
  //       {
  //         headers: { Authorization: `Bearer ${token}` },
  //       },
  //     );

  //     setPersonal((prev) => ({ ...prev, is_active: newStatus }));
  //     setAdminAttendance((prev) =>
  //       prev.map((e) =>
  //         String(e.emp_id) === String(emp_id)
  //           ? { ...e, is_active: newStatus }
  //           : e,
  //       ),
  //     );
  //     toast.success(`Employee ${newStatus ? "Activated" : "Deactivated"}`);
  //   } catch {
  //     toast.error("Status update failed");
  //   } finally {
  //     setIsToggling(false);
  //   }
  // };

  // const handleSavePersonal = async (updatedData) => {
  //   try {
  //     // Logic for saving personal info specifically
  //     await updatePersonal(emp_id, updatedData);
  //     setPersonal((prev) => ({ ...prev, ...updatedData }));
  //     toast.success("Profile updated successfully");
  //     setIsEditing(false);
  //   } catch (err) {
  //     toast.error(err.response?.data?.message || "Update failed");
  //   }
  // };

   const handleProfileUpload = async (e) => {

    // console.log("click Profile")
    const file = e.target.files[0];
 if (!file || !urlEmpId) return;

    const formData = new FormData();
    formData.append("profile", file);

    try {
      const res = await api.post(`employee/profile/image/${urlEmpId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // console.log("profile Res",res);

      setRefreshTrigger((prev) => prev + 1);
      toast.success("Profile Image Updated");
    } catch (error) {

      // console.log(error);
      toast.error("Failed to upload image");
    }
  };
  // const refreshPage = () => {
  //   fetchAllData();
  //   toast.success("Data Refreshed");
  // };

  return (
    <div className=" min-h-screen p-6">
      <div className="max-w-6xl bg-transparent mx-auto  rounded-xl">
        {/* HEADER */}
        <div className="sticky z-20 top-0 bg-[#222F7D] rounded-xl py-3 mb-6 shadow-lg flex justify-center items-center px-6">
          <Typography className="text-white text-xl sm:text-2xl font-bold">
            {/* {user?.role === "admin" ? "Admin Profile" : "Employee Profile"}
             */}
            Employee Profile
          </Typography>
        </div>
        

        {/* PROFILE HEADER SECTION */}
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-[4fr_1.5fr] gap-6">
          {/* LEFT CARD */}
          <div className="bg-white rounded-xl shadow p-4 sm:p-6 h-25">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="relative w-32 h-32">
  <label htmlFor="profileUpload" className="cursor-pointer block w-full h-full">
    <img
      src={profileImage || defaultProfile}
      alt="Profile"
      className="w-full h-full rounded-full border-4 border-[#222F7D] object-cover"
    />

    <div className="absolute bottom-1 right-1 bg-[#222F7D] text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white">
      ✎
    </div>
  </label>

  <input
    id="profileUpload"
    type="file"
    className="hidden"
    onChange={handleProfileUpload}
  />
</div>
 

              <div className="w-full text-center md:text-left">
                <h2 className="text-xl font-bold text-gray-800">
                  {employeeBasic?.name || "Employee Name"}
                </h2>

                <p className="text-[#222F7D] font-bold text-xs tracking-wider uppercase">
                  {employeeBasic?.role || "Employee"}
                </p>

                <p className="text-gray-500 text-sm mt-1">ID: {emp_id}</p>

                <div className="flex flex-col sm:flex-row gap-4 mt-4 text-gray-600 text-sm justify-center md:justify-start">
                  <span className="flex items-center gap-2">
                    <IoHomeSharp className="text-[#222F7D]" />
                    {personalAddress?.current_address || "Office Address"}
                  </span>

                  <span className="flex items-center gap-2">
                    <MdOutlineEmail className="text-[#222F7D] text-lg" />
                    {employeeBasic?.email || "Email"}
                  </span>
                </div>
              </div>
            </div>
            <Divider className="my-6" />
          </div>

          {/* RIGHT REPORTING */}
          <div className="bg-white rounded-xl shadow p-4 h-25">
            <ReportingCard reportingManagers={reporting} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto bg-transparent mt-5 rounded-xl shadow min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-500 italic">
            <Loader/>
          </div>
        ) : (
          <MainProfile
            personalData={personal}
            educationData={education}
            experienceData={experience}
            nomineeData={nominee}
            contactData={contact}
            bankData={bank}
            userRole={user.role}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            // onSave={handleSavePersonal} // Specifically for personal tab
            empId={emp_id}
            onSave={fetchAllData}
            isAddingNew={isAddingNew}
            setIsAddingNew={setIsAddingNew}
          />
        )}
      </div>
    </div>
  );
};

export default EmployeeDetails;
