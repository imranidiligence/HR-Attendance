import React, { useState } from "react";
import { toast } from "react-hot-toast";
import MainProfile from "../profile/MainProfile";
import { addEmploy } from "../../services/authServices";
import defaultProfile from "../assets/avatar.webp";
import { Typography, Divider } from "@mui/material";
import { MdOutlineEmail } from "react-icons/md";
import { IoHomeSharp } from "react-icons/io5";
import ReportingCard from "../components/ReportingCard";
import CreateEmployeeBasic from "./CreateBasicEmp";

const AddEmployee = () => {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(true);

  const [profileImage, setProfileImage] = useState("");
  const [reporting, setReporting] = useState([]);
  const [empId, setEmpId] = useState("");
  const [newEmpId, setNewEmpId] = useState("");

  // const [empId, setEmpId] = useState(null);
  //  Controlled Personal State
  const [personalData, setPersonalData] = useState({
    first_name: "",
    last_name: "",  
    email: "",
    password: "",
    emp_id: "",
    role: "employee",
    is_active: true,
    shift_id: 3,
    dob: "",
    gender: "",
    department: "",
    joining_date: "",
    maritalstatus: "",
    nominee: "",
    aadharnumber: "",
    bloodgroup: "",
    nationality: "",
    current_address: "",
    profile_image: null,
  });

  //  Profile Image Upload
  const handleProfileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPersonalData((prev) => ({
      ...prev,
      profile_image: file,
    }));

    setProfileImage(URL.createObjectURL(file));
  };

  // Create Employee
  const handleCreateEmployee = async (data) => {
    try {
      setLoading(true);

      const formData = new FormData();

      Object.keys(data).forEach((key) => {
        if (data[key] !== null && data[key] !== undefined) {
          formData.append(key, data[key]);
        }
      });

      await addEmploy(formData);
      toast.success("Employee Created Successfully");

      // optional reset
      setPersonalData({});
      setProfileImage("");
      setEmpId("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto rounded-xl">
        {/* HEADER */}
        <div className="sticky z-20 top-0 bg-[#222F7D] rounded-xl py-3 mb-6 shadow-lg flex justify-center items-center px-6">
          <Typography className="text-white text-xl sm:text-2xl font-bold">
            Add New Employee
          </Typography>
        </div>

        {/* PROFILE SECTION */}
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-[4fr_1.5fr] gap-6">
          {/* LEFT CARD */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
              {/* PROFILE IMAGE */}
              <div className="relative w-32 h-32">
                <label
                  htmlFor="profileUpload"
                  className="cursor-pointer block w-full h-full"
                >
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

              {/* BASIC INFO */}
              <div className="w-full text-center md:text-left">
                <h2 className="text-xl font-bold text-gray-800">
                  {personalData.name || "Employee Name"}
                </h2>

                <p className="text-[#222F7D] font-bold text-xs tracking-wider uppercase">
                  {personalData.role}
                </p>

                <p className="text-gray-500 text-sm mt-2">
                  ID:
                  <input
                    type="text"
                    value={newEmpId}
                    onChange={(e) => {
                      // setEmpId(e.target.value);
                      setNewEmpId(e.target.value);
                      setPersonalData((prev) => ({
                        ...prev,
                        // emp_id: e.target.value,
                        newEmpId: e.target.value,
                      }));
                    }}
                    className="border rounded px-3 py-2 ml-2 text-sm bg-gray-100 focus:ring-2 focus:ring-[#222F7D]"
                  />
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mt-4 text-gray-600 text-sm justify-center md:justify-start">
                  <span className="flex items-center gap-2">
                    <IoHomeSharp className="text-[#222F7D]" />
                    {personalData.current_address || "Office Address"}
                  </span>

                  <span className="flex items-center gap-2">
                    <MdOutlineEmail className="text-[#222F7D] text-lg" />
                    {personalData.email || "Email"}
                  </span>
                </div>
              </div>
            </div>

            <Divider className="my-6" />
          </div>

          {/* RIGHT SIDE REPORTING */}
          <div className="bg-white rounded-xl shadow p-4">
            <ReportingCard reportingManagers={reporting} />
          </div>
        </div>
      </div>

      {/* MAIN PROFILE FORM */}
      <div className="max-w-6xl mx-auto mt-5 rounded-xl min-h-[400px]">
        {/* {!empId ? (
      <CreateEmployeeBasic onCreated={(id) => setEmpId(id)} />
    ) : (
    )} */}
        <MainProfile
          // organizationData={organizationData}
          // personalData={personalData}
          // educationData={educationData}
          // experienceData={experienceData}
          // contactData={contactsData}
          // nomineeData={nomineeData}
          // bankData={bankData}
          // userRole={user?.role}
          // isEditing={isEditing}
          // setIsEditing={setIsEditing}
          // onSave={handleDataRefresh} // Passing refresh function
          empId={empId}
          // isAddingNew={isAddingNew}
          // setIsAddingNew={setIsAddingNew}
        />
      </div>
    </div>
  );
};

export default AddEmployee;

// import React, { useState } from "react";
// import { toast } from "react-hot-toast";
// import MainProfile from "../profile/MainProfile";
// import { addEmploy } from "../../services/authServices";
// // import defaultProfile from "../assets/avatar.webp";
// import { Typography, Divider } from "@mui/material";
// import { MdOutlineEmail } from "react-icons/md";
// import { IoHomeSharp } from "react-icons/io5";
// import ReportingCard from "../components/ReportingCard";

// const AddEmployee = () => {
//   const [loading, setLoading] = useState(false);
//   const [isEditing, setIsEditing] = useState(false);
//   const [isAddingNew, setIsAddingNew] = useState(false);

//   const emp_id = "";
//   // const isAdmin = user.role === "admin";

//   // ===== Header Data States =====
//   const [profileImage, setProfileImage] = useState("");
//   const [reporting, setReporting] = useState([]);
//   const [employeeBasic, setEmployeeBasic] = useState({});

//   // Empty structures (same shape as EmployeeDetails expects)
//   const emptyPersonal = {
//     name: "",
//     email: "",
//     password: "",
//     emp_id: "",
//     role: "employee",
//     is_active: true,
//     shift_id: 3,
//     dob: "",
//     gender: "",
//     department: "",
//     joining_date: "",
//     maritalstatus: "",
//     nominee: "",
//     aadharnumber: "",
//     bloodgroup: "",
//     nationality: "",
//     address: "",
//     profile_image: null,
//   };

//   const [formData, setFormData] = useState(emptyPersonal);
//   const [errors, setErrors] = useState({});
//   // const [loading, setLoading] = useState(false);

//   const handleChange = (e) => {
//     const { name, value, type, checked, files } = e.target;

//     // Clear error for specific field
//     if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));

//     if (type === "file") {
//       setFormData((prev) => ({ ...prev, [name]: files[0] }));
//     } else {
//       setFormData((prev) => ({
//         ...prev,
//         [name]: type === "checkbox" ? checked : value,
//       }));
//     }
//   };

//   const validate = () => {
//     const newErrors = {};
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//     if (!formData.name.trim()) newErrors.name = "Full Name is required";
//     if (!formData.emp_id.trim()) newErrors.emp_id = "Employee ID is required";
//     if (!formData.department.trim()) newErrors.department = "Department is required";
//     if (!formData.role) newErrors.role = "Role is required";

//     if (!formData.email) {
//       newErrors.email = "Email is required";
//     } else if (!emailRegex.test(formData.email)) {
//       newErrors.email = "Invalid email address";
//     }

//     if (!formData.password) {
//       newErrors.password = "Password is required";
//     } else if (formData.password.length < 6) {
//       newErrors.password = "Minimum 6 characters required";
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleAddEmp = async (e) => {
//     e.preventDefault();

//     if (!validate()) {
//       toast.error("Please fill in all required fields.");
//       return;
//     }

//     try {
//       setLoading(true);

//       const data = new FormData();

//       // Correctly appending data
//       Object.keys(formData).forEach((key) => {
//         if (formData[key] !== null && formData[key] !== undefined) {
//           data.append(key, formData[key]);
//         }
//       });

//       console.log("Formdata",data)
//       // Verification log (FormData looks empty in standard console.log)
//       console.log("--- Sending Payload ---");
//       for (let [key, value] of data.entries()) {
//         console.log(`${key}:`, value);
//       }

//       await addEmploy(data);
//       toast.success("New Employee Record Created Successfully!");

//       setFormData(initialFormState);
//       setErrors({});

//     } catch (error) {
//       console.error("Submission Error:", error);
//       toast.error(error.response?.data?.message || "Failed to sync employee data");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="max-w-screen mx-auto mt-0 sm:mt-10 mb-10 sm:mb-20 px-0 sm:px-4 font-sans text-gray-800">
//       <div
//               className={`sticky z-20 top-2 bg-[#222F7D] rounded-xl py-3 mb-6 shadow-lg flex justify-center items-center px-6 h-[40px] -mt-[32px]`}
//             >
//               {/* */}
//               <Typography className="text-white text-2xl sm:text-2xl text-center font-bold tracking-wide py-0">
//                 Add Employee
//               </Typography>
//             </div>
//     {/* <div className="bg-white rounded-none sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

//       {/* ERP Header */}
//       {/* <div className="px-6 py-5 bg-gray-50 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
//         <div>
//           <h2 className="text-xl font-bold text-gray-800 tracking-tight">Onboard New Employee</h2>
//           <p className="text-sm text-gray-500">Fill in all details to generate employee profile</p>
//         </div>
//         <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border sm:border-none">
//           <span className="text-xs font-semibold text-gray-400 uppercase">Status:</span>
//           <input
//             type="checkbox"
//             name="is_active"
//             checked={formData.is_active}
//             onChange={handleChange}
//             className="w-5 h-5 accent-green-600 cursor-pointer"
//           />
//           <span className="text-sm font-medium text-gray-700">Active Account</span>
//         </div>
//       </div> */}

//       {/* <form onSubmit={handleAddEmp} className="p-6 sm:p-8 space-y-10">

//         {/* Section 1: Authentication */}
//         {/* <section>
//           <h3 className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
//             <span className="w-8 h-px bg-blue-200"></span> Basic Credentials
//           </h3>

//           {/* Responsive Grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
//           {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
//             <Input label="Full Name *" name="name" value={formData.name} onChange={handleChange} error={errors.name} placeholder="John Doe" />
//             <Input label="Email Address *" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="john@company.com" />
//             <Input label="System Password *" name="password" type="password" value={formData.password} onChange={handleChange} error={errors.password} placeholder="••••••••" />
//             <Input label="Employee ID *" name="emp_id" value={formData.emp_id} onChange={handleChange} error={errors.emp_id} placeholder="202500028" />
//             <Input label="Department *" name="department" value={formData.department} onChange={handleChange} error={errors.department} placeholder="IT / Engineering" />
//             <Input label="Nationality" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="Indian" />

//             <div className="flex flex-col">
//               <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-tight">Role *</label>
//               <select
//                 name="role"
//                 value={formData.role}
//                 onChange={handleChange}
//                 className={`w-full rounded-lg border px-3 py-2.5 text-base sm:text-sm bg-white focus:ring-4 outline-none transition-all ${
//                   errors.role ? "border-red-500 focus:ring-red-100" : "border-gray-200 focus:ring-blue-100 focus:border-blue-400"
//                 }`}
//               >
//                 <option value="employee">Employee</option>
//                 <option value="admin">Admin</option>
//               </select>
//               {errors.role && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.role}</p>}
//             </div>
//           </div> */}
//         {/* </section> */}

//         {/* Section 2: Personal Information */}
//         {/* <section>
//           <h3 className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
//             <span className="w-8 h-px bg-blue-200"></span> Personal Information
//           </h3>
//           {/* Responsive Grid: 1 col on mobile, 2 on tablet, 4 on desktop */}
//           {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
//             <I>nput label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleChange} />
//             <Select label="Gender" name="gender" value={formData.gender} onChange={handleChange} options={[{v:"Male", l:"Male"}, {v:"Female", l:"Female"}, {v:"Other", l:"Other"}]} />
//             <Select label="Marital Status" name="maritalstatus" value={formData.maritalstatus} onChange={handleChange} options={[{v:"Single", l:"Single"}, {v:"Married", l:"Married"}]} />
//             <Input label="Blood Group" name="bloodgroup" value={formData.bloodgroup} onChange={handleChange} placeholder="A+" />
//             <Input label="Aadhar/National ID" name="aadharnumber" value={formData.aadharnumber} onChange={handleChange} placeholder="0000 0000 0000" />
//             <Input label="Joining Date" name="joining_date" type="date" value={formData.joining_date} onChange={handleChange} />
//             <div className="sm:col-span-2">
//               <Input label="Address" name="address" value={formData.address} onChange={handleChange} placeholder="Full residential address" />
//             </div>
//           </div> */}
//         {/* </section> */}

//         {/* Action Buttons */}
//         {/* <div className="pt-8 border-t flex flex-col sm:flex-row justify-end gap-4"> */}
//           {/* <button
//             type="submit"
//             disabled={loading}
//             className="w-full sm:w-auto px-10 py-4 sm:py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-nowrap"
//           >
//           Register
//           </button>
//         </div> */}
//       {/* </form> */}
//     {/* </div> */}

//       <div className="mx-auto mt-2">
//         <div className="bg-white rounded-xl shadow-sm overflow-hidden">
//           <MainProfile
//             // organizationData={organizationData}
//             // personalData={personalData}
//             // educationData={educationData}
//             // experienceData={experienceData}
//             // contactData={contactsData}
//             // nomineeData={nomineeData}
//             // bankData={bankData}
//             // userRole={user?.role}
//             isEditing={isEditing}
//             setIsEditing={setIsEditing}
//             // onSave={handleDataRefresh} // Passing refresh function
//             // empId={empId}
//             // isAddingNew={isAddingNew}
//             // setIsAddingNew={setIsAddingNew}
//           />
//         </div>
//       </div>
//   </div>
//   );
// };

// /* Components maintained exactly as requested */
// const Input = ({ label, name, type = "text", value, onChange, placeholder, error }) => (
//   <div className="flex flex-col">
//     <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-tight">{label}</label>
//     <input
//       type={type}
//       name={name}
//       value={value}
//       onChange={onChange}
//       placeholder={placeholder}
//       className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all ${
//         error ? "border-red-500 focus:ring-red-100" : "border-gray-200 focus:ring-blue-100 focus:border-blue-400"
//       } focus:ring-4`}
//     />
//     {error && <span className="text-[10px] text-red-500 mt-1 font-medium">{error}</span>}
//   </div>
// );

// const Select = ({ label, name, value, onChange, options }) => (
//   <div className="flex flex-col">
//     <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-tight">{label}</label>
//     <select
//       name={name}
//       value={value}
//       onChange={onChange}
//       className="w-full rounded-lg border-gray-200 border px-3 py-2.5 text-sm bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
//     >
//       <option value="">Select Option</option>
//       {options.map((opt) => (
//         <option key={opt.v} value={opt.v}>{opt.l}</option>
//       ))}
//     </select>
//   </div>
// );

// export default AddEmployee;
