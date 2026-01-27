import React, { useState } from "react";
import { Button, Typography } from "@mui/material";
import { changePassword } from "../../services/authServices";
import { toast } from "react-hot-toast";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const ChangePassword = () => {

  const user = JSON.parse(localStorage.getItem("user"));
  const [empData, setEmpData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Toggle password visibility
  const togglePassword = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // Handle input change
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setEmpData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Validation
  const validatePassword = () => {
    const { currentPassword, newPassword, confirmPassword } = empData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All fields are required");
      return false;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return false;
    }

    return true;
  };

  // Submit
  const changePasswordEmp = async (e) => {
    e.preventDefault();

    if (!validatePassword()) return;

    try {
      const resp = await changePassword({
        currentPassword: empData.currentPassword,
        newPassword: empData.newPassword,
      });

      toast.success(resp?.data?.message || "Password changed successfully");

      setEmpData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Failed to change password. Try again.";
      toast.error(message);
    }
  };

  return (
    <div className="px-3 pb-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-[#222F7D] rounded-lg mb-6">
        <Typography className="text-white py-2 text-2xl text-center">
         {user?.role === 'admin' ? "Admin Change Password":"Employee Change Password"} 
        </Typography>
      </div>

      {/* Card */}
      <form
        onSubmit={changePasswordEmp}
        className="max-w-md mx-auto bg-white rounded-xl shadow-md border px-6 py-6 space-y-5"
      >
        {/* Current Password */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Current Password
          </label>
          <input
            name="currentPassword"
            value={empData.currentPassword}
            onChange={handlePasswordChange}
            type={showPassword.current ? "text" : "password"}
            placeholder="********"
            className="w-full rounded-lg border bg-gray-50 px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <span
            className="absolute right-3 top-[38px] cursor-pointer text-gray-500"
            onClick={() => togglePassword("current")}
          >
            {showPassword.current ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        {/* New Password */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            New Password
          </label>
          <input
            name="newPassword"
            value={empData.newPassword}
            onChange={handlePasswordChange}
            type={showPassword.new ? "text" : "password"}
            placeholder="********"
            className="w-full rounded-lg border bg-gray-50 px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <span
            className="absolute right-3 top-[38px] cursor-pointer text-gray-500"
            onClick={() => togglePassword("new")}
          >
            {showPassword.new ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Confirm Password
          </label>
          <input
            name="confirmPassword"
            value={empData.confirmPassword}
            onChange={handlePasswordChange}
            type={showPassword.confirm ? "text" : "password"}
            placeholder="********"
            className="w-full rounded-lg border bg-gray-50 px-4 py-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <span
            className="absolute right-3 top-[38px] cursor-pointer text-gray-500"
            onClick={() => togglePassword("confirm")}
          >
            {showPassword.confirm ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{
            py: 1.2,
            fontWeight: 600,
            borderRadius: "8px",
          }}
        >
          Reset Password
        </Button>
      </form>
    </div>
  );
};

export default ChangePassword;
