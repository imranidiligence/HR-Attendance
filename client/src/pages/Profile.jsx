import React, { useContext, useEffect, useState, useCallback } from "react";
import { Typography, Divider } from "@mui/material";
import { IoHomeSharp } from "react-icons/io5";
import { MdOutlineEmail } from "react-icons/md";
import avatarImg from "../assets/avatar.webp";
import { toast } from "react-hot-toast";

import {
  getEducation,
  getExperience,
  getPersonal,
  getContact,
  getBank,
  getOrganization,
  getNominee,
} from "../../api/profile";

import { EmployContext } from "../context/EmployContextProvider";
import MainProfile from "../profile/MainProfile";
import ReportingCard from "../components/ReportingCard";
import api from "../../api/axiosInstance";
import OrganizationTab from "../profile/tabs/OrganizationTab";
import { useParams } from "react-router-dom";

const Profile = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const { emp_id } = useParams()
  const empId = user?.emp_id;
  const finalEmpId = emp_id ? emp_id : empId;


  const { profileImage, setProfileImage, orgAddress, personalAddress } =
    useContext(EmployContext);

  const [address, setAddress] = useState("");

  // console.log("personalAddress",personalAddress);
  // --- State Management ---
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [reporting, setReporting] = useState([]);

  // Data States
  const [organizationData, setOrganizationData] = useState({});

  const [personalData, setPersonalData] = useState({});
  const [educationData, setEducationData] = useState([]);
  const [experienceData, setExperienceData] = useState([]);
  const [contactsData, setContactsData] = useState([]);
  const [bankData, setBankData] = useState({});
  const [nomineeData, setNomineeData] = useState([]);


  //  const isOwnProfile = finalEmpId === empId;
  // const canEditImage = user?.role === "admin" || isOwnProfile;

  // console.log("canEditImage",canEditImage);
  // console.log("finalEmpId",finalEmpId);

  // console.log("finalEmpId",finalEmpId);

  const fetchProfileData = useCallback(async () => {
    if (!finalEmpId) return;

    try {
      const results = await Promise.allSettled([
        getOrganization(),
        getPersonal(finalEmpId),
        getEducation(finalEmpId),
        getExperience(finalEmpId),
        getContact(finalEmpId),
        getNominee(finalEmpId),
        getBank(finalEmpId),
      ]);

      if (results[0].status === "fulfilled") {

        // console.log("results organization", results[0].value.data);

        setOrganizationData(results[0].value.data.personalDetails || {});
      }

      if (results[1].status === "fulfilled")
        setPersonalData(results[1].value.data.personalDetails || {});

      if (results[2].status === "fulfilled")
        setEducationData(results[2].value.data.education || []);

      if (results[3].status === "fulfilled")
        setExperienceData(results[3].value.data.experience || []);

      if (results[4].status === "fulfilled")
        setContactsData(results[4].value.data.contacts || []);

      if (results[5].status === "fulfilled")
        setNomineeData(results[5].value.data.nominee || []);

      if (results[6].status === "fulfilled")
        setBankData(results[6].value.data.bankInfo || {});
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }, [finalEmpId]);


  // console.log("Profile Education",educationData);


  // --- 2. Fetch Profile Image ---
  const fetchProfileImage = useCallback(async () => {
    try {
      if (!token || !finalEmpId) return;

      const res = await api.get(
        `employee/profile/image/${finalEmpId}`
      );

      if (res.data?.profile_image) {
        const newUrl = `${res.data.profile_image}?t=${Date.now()}`;
        setProfileImage(newUrl);
      }

    } catch (error) {
      console.error("Error fetching image:", error);
    }
  }, [token, finalEmpId, setProfileImage]);


  // --- 3. Fetch Reporting Manager ---
  const fetchReporting = useCallback(async () => {
    try {
      const res = await api.get(`employees/reporting/${finalEmpId}`);
      setReporting(res.data.managers || []);
    } catch (error) {
      console.error("Failed to fetch reporting managers", error);
    }
  }, [finalEmpId]);

  useEffect(() => {
    fetchProfileData();
    fetchProfileImage();
    fetchReporting();
  }, [fetchProfileData, fetchProfileImage, fetchReporting, refreshTrigger, finalEmpId, token]);

  useEffect(() => {
    // console.log("profileImage", profileImage);

  }, [profileImage]);

  const BASE_URL = import.meta.env.VITE_DOC;

  // --- Handlers ---
  const handleProfileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !finalEmpId) return;

    const formData = new FormData();
    formData.append("profile", file);

    try {
      const res = await api.post(
        `employee/profile/image/${finalEmpId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // Get new image path from backend
      const newImagePath = res.data?.profile_image;

      if (newImagePath) {
        //  Update localStorage user
        const user = JSON.parse(localStorage.getItem("user") || "{}");

        const updatedUser = {
          ...user,
          profile_image: newImagePath,
        };

        localStorage.setItem("user", JSON.stringify(updatedUser));

        // If using context, update there also
        setProfileImage(newImagePath);
      }

      toast.success("Profile Image Updated");
    } catch (error) {
      console.log(error);
      toast.error("Failed to upload image");
    }
  };

  // This function is passed to child tabs. When they save, they call this.
  const handleDataRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    const getPersonalAddress = async () => {
      try {
        const resp = await getPersonal(finalEmpId);

        // console.log("Profile details",resp.data);
        setAddress(resp.data.
          current_address)
      } catch (error) {
        console.log(error);
      }

    }
    getPersonalAddress();

  }, [])

  // console.log("orgAddress",orgAddress)
  return (
    <div className="min-h-screen py-4 px-3 sm:py-6 sm:px-4 bg-gray-50/70">
      {/* HEADER */}

      <div className="sticky z-20 top-0 bg-[#222F7D] rounded-xl py-3 mb-6 shadow-lg flex justify-center items-center px-6 h-[40px] -mt-2">
        <Typography className="text-white text-2xl sm:text-2xl text-center font-bold tracking-wide py-0">
          {user?.role === "admin" ? "Admin Profile" : "Employee Profile"}
        </Typography>
      </div>

      <div className="mx-auto grid grid-cols-1 lg:grid-cols-[4fr_1.5fr] gap-6">
        {/* LEFT: Profile Card */}
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 h-25">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="relative w-32 h-32 group">

              <label className="cursor-pointer block w-full h-full">
                <img
                  src={
                    user.profile_image
                      ? `${BASE_URL}${user.profile_image}`
                      : user?.profile_image
                        ? `${BASE_URL}${user.profile_image}`
                        : avatarImg
                  }
                  alt="Profile"
                  className="w-full h-full rounded-full border-4 border-[#222F7D] object-cover"
                />
                <input
                  type="file"
                  className="hidden"
                  onChange={handleProfileUpload}
                />
                <div className="absolute bottom-1 right-1 bg-[#222F7D] text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white">
                  ✎
                </div>
              </label>

            </div>

            <div className="w-full text-center md:text-left">
              <h2 className="text-xl font-bold text-gray-800">{user?.name}</h2>
              <p className="text-[#222F7D] font-bold text-xs tracking-wider uppercase">
                {user?.role}
              </p>
              <p className="text-gray-500 text-sm mt-1">ID: {finalEmpId}</p>

              <div className="flex flex-col sm:flex-row gap-4 mt-4 text-gray-600 text-sm justify-center md:justify-start">
                <span className="flex items-center gap-2">
                  <IoHomeSharp className="text-[#222F7D]" />{" "}
                  {/* {JSON.stringify(personalAddress)} */}
                  {address || "Office Address"}
                </span>
                <span className="flex items-center gap-2">
                  <MdOutlineEmail className="text-[#222F7D] text-lg" />{" "}
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
          <Divider className="my-6" />
        </div>

        {/* RIGHT: Reporting */}
        <div className="bg-white rounded-xl shadow p-4 h-25">
          <ReportingCard reportingManagers={reporting} />
        </div>
      </div>

      {/* TABS CONTENT */}
      <div className="mx-auto mt-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <MainProfile
            organizationData={organizationData}
            personalData={personalData}
            educationData={educationData}
            experienceData={experienceData}
            contactData={contactsData}
            nomineeData={nomineeData}
            bankData={bankData}
            userRole={user?.role}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onSave={handleDataRefresh} // Passing refresh function
            empId={empId}
            isAddingNew={isAddingNew}
            setIsAddingNew={setIsAddingNew}
          />
        </div>
      </div>
    </div>
  );
};

export default Profile;
