import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import FormCard from "../components/FormCard";

const TABS = [
  { key: "personal", label: "Personal Info" },
  { key: "contact", label: "Contact" },
  { key: "education", label: "Education" },
  { key: "experience", label: "Experience" },
  { key: "bank", label: "Bank Details" },
  { key: "documents", label: "Documents" },
];

const DataField = ({ label, value, highlight = false }) => (
  <div className="flex flex-col border-b border-gray-100 py-2">
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    <span className={`text-sm ${highlight ? "text-gray-500 font-bold" : "text-gray-800"}`}>
      {value || "—"}
    </span>
  </div>
);

const DocumentRow = ({ label, file }) => {
  if (!file) return <span className="text-gray-400 italic text-sm">Not Uploaded</span>;
  const isPdf = file.toLowerCase().endsWith(".pdf");
  return (
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded border border-dashed border-gray-300">
      {isPdf ? (
        <a href={file} target="_blank" rel="noreferrer" className="text-blue-600 font-medium text-sm hover:underline flex items-center gap-2">
          📄 View {label}
        </a>
      ) : (
        <img src={file} alt={label} className="w-16 h-16 object-cover rounded shadow-sm" />
      )}
    </div>
  );
};

const EmployeeDetails = () => {
  const { emp_id } = useParams();
  const token = localStorage.getItem("token");
  const [activeTab, setActiveTab] = useState("personal");
  const [personal, setPersonal] = useState({});
  const [contact, setContact] = useState([]);
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [bank, setBank] = useState([]);
  const [documents, setDocuments] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  const fetchEmployeeDetails = async () => {
    if (!emp_id) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [p, c, edu, exp, b, d] = await Promise.all([
        axios.get(`http://localhost:5000/api/employee/profile/personal/${emp_id}`, { headers }),
        axios.get(`http://localhost:5000/api/employee/profile/contact/${emp_id}`, { headers }),
        axios.get(`http://localhost:5000/api/employee/profile/education/${emp_id}`, { headers }),
        axios.get(`http://localhost:5000/api/employee/profile/experience/${emp_id}`, { headers }),
        axios.get(`http://localhost:5000/api/employee/profile/bank/${emp_id}`, { headers }),
        axios.get(`http://localhost:5000/api/employee/profile/bank/doc/${emp_id}`, { headers }),
      ]);

      setPersonal(p.data || {});
      setContact(c.data.contacts || []);
      setEducation(edu.data.education || []);
      setExperience(exp.data.experience || []);
      setBank(b.data.bankDetails || []);
      
      const docObj = {};
      (d.data?.documents || []).forEach((doc) => { docObj[doc.file_type] = doc.file_path; });
      setDocuments(docObj);
    } catch (err) {
      // toast.error("ERP: Data Retrieval Failed");
      console.log(err);
    }
  };

  useEffect(()=>{
    console.log("education",education);
  },[education]);


  useEffect(() => { fetchEmployeeDetails(); }, [emp_id]);

  const handleDownload = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      
      // Extracts the filename from the URL (e.g., "aadhaar.jpg")
      const filename = imageUrl.split('/').pop().split('?')[0]; 
      link.setAttribute("download", filename || "document.png");
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4 lg:p-8">
      {/* Header Section */}
      <div className="max-w-6xl mx-auto bg-white rounded-t-xl shadow-sm border-b border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{personal.name || "Employee Profile"}</h1>
            <p className="text-blue-600 font-mono text-sm tracking-widest uppercase">EMP-ID: {emp_id}</p>
          </div>
          <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase ${personal.is_active ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
            ● {personal.is_active ? "Active Record" : "Inactive"}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-8 overflow-x-auto no-scrollbar border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`px-6 py-3 text-sm font-medium transition-all duration-200 whitespace-nowrap border-b-2 ${
                activeTab === tab.key ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-6xl mx-auto bg-white rounded-b-xl shadow-sm p-6 min-h-[400px]">
      {activeTab === "personal" && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-4">
    {/* Identity & Basic Info */}
    <DataField label="Full Name" value={personal.name} highlight />
    <DataField label="Employee ID" value={personal.emp_id} highlight />
    <DataField label="Official Email" value={personal.email} />
    
    {/* Job Details */}
    <DataField label="Department" value={personal.department} highlight />
    <DataField label="Designation / Role" value={personal.role} />
    <DataField label="Employment Status" value={personal.is_active ? "Active" : "Inactive"} />
    
    {/* Dates */}
    <DataField label="Date of Birth" value={personal.dob} />
    <DataField label="Date of Joining" value={personal.joining_date} />
    
    {/* Personal Details */}
    <DataField label="Gender" value={personal.gender} />
    <DataField label="Marital Status" value={personal.maritalstatus} />
    <DataField label="Nationality" value={personal.nationality} />
    <DataField label="Blood Group" value={personal.bloodgroup} />
    
    {/* Identification & Family */}
    <DataField label="Aadhaar Number" value={personal.aadharnumber} />
    {/* <DataField label="Nominee" value={personal.nominee} /> */}
    
    {/* Contact/Address - Full width span if you like */}
    <div className="md:col-span-2 lg:col-span-3">
        <DataField label="Residential Address" value={personal.address} />
    </div>
  </div>
)}

{(activeTab === "contact" || activeTab === "education" || activeTab === "experience") && (
  <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        {activeTab === "contact" && (
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Phone</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Relation</th>
          </tr>
        )}
        {activeTab === "education" && (
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Degree</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Institution</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Field Of Study</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Passing Year</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Result</th>
          </tr>
        )}
        {/* Added Experience Headers */}
        {activeTab === "experience" && (
          <tr>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Company</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Designation</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Duration</th>
            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Years</th>
          </tr>
        )}
      </thead>
      <tbody className="bg-white divide-y divide-gray-100 text-sm text-gray-700">
        {activeTab === "contact" && contact.map((c, i) => (
          <tr key={i} className="hover:bg-blue-50/30">
            <td className="px-6 py-4 font-semibold text-gray-600">{c.contact_type}</td>
            <td className="px-6 py-4">{c.email}</td>
            <td className="px-6 py-4 font-mono">{c.phone}</td>
            <td className="px-6 py-4 italic">{c.relation}</td>
          </tr>
        ))}
        {activeTab === "education" && education.map((edu, i) => (
          <tr key={i} className="hover:bg-blue-50/30">
            <td className="px-6 py-4 font-semibold">{edu.degree}</td>
            <td className="px-6 py-4 text-gray-500">{edu.institution_name}</td>
            <td className="px-6 py-4 text-gray-500">{edu.field_of_study}</td>
            <td className="px-6 py-4">{edu.passing_year}</td>
            <td className="px-6 py-4 font-bold text-gray-500">{edu.percentage_or_grade} %</td>
          </tr>
        ))}
        {/* Added Experience Body Rows */}
        {activeTab === "experience" && experience.map((exp, i) => (
          <tr key={i} className="hover:bg-blue-50/30">
            <td className="px-6 py-4 font-semibold text-gray-900">{exp.company_name}</td>
            <td className="px-6 py-4 text-gray-600 font-medium">{exp.designation}</td>
            <td className="px-6 py-4 text-gray-500">
              {exp.start_date ? new Date(exp.start_date).toLocaleDateString() : 'N/A'} - 
              {exp.end_date ? new Date(exp.end_date).toLocaleDateString() : 'Present'}
            </td>
            <td className="px-6 py-4">
              <span className=" text-gray-500 px-2 py-1 rounded-md text-xs font-bold">
                {parseInt(exp.total_years) || 0} Yrs
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {/* Empty State Check */}
    {((activeTab === "contact" && contact.length === 0) || 
      (activeTab === "education" && education.length === 0) || 
      (activeTab === "experience" && experience.length === 0)) && (
      <div className="p-10 text-center text-gray-400 italic">
        No records found for this section.
      </div>
    )}
  </div>
)}
        {activeTab === "bank" && (
          <div className="space-y-6">
            {bank.map((b, i) => (
              <div key={i} className="p-4 border border-blue-100 bg-blue-50/20 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DataField label="Account Holder" value={b.account_holder_name} />
                <DataField label="Bank Name" value={b.bank_name} />
                <DataField label="Account No" value={b.account_number} highlight />
                <DataField label="IFSC Code" value={b.ifsc_code} />
                <DataField label="Branch" value={b.branch_name} />
                <DataField label="Type" value={b.account_type} />
                <DataField label="PAN Number" value={b.pan_number} />
              </div>
            ))}
          </div>
        )}

{activeTab === "documents" && (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    {["aadhaar", "pan", "passbook", "address_proof"].map((key) => {
      const imageUrl = documents[key] ? `http://localhost:5000${documents[key]}` : null;
      
      return (
        <div 
          key={key} 
          className="p-4 border border-gray-100 rounded-lg bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => imageUrl && setPreviewImage(imageUrl)} // Set image on click
        >
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">{key.replace("_", " ")}</h4>
          <DocumentRow label={key.toUpperCase()} file={imageUrl} />
        </div>
      );
    })}
  </div>
)}

{previewImage && (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 transition-opacity"
    onClick={() => setPreviewImage(null)} 
  >
    {/* Action Buttons Container */}
    <div className="absolute top-5 right-10 flex gap-4" onClick={(e) => e.stopPropagation()}>
      
      {/* Download Button */}
      <button 
        onClick={() => handleDownload(previewImage)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download
      </button>

      {/* Close Button */}
      <button 
        className="text-white text-4xl leading-none hover:text-gray-300 transition-colors"
        onClick={() => setPreviewImage(null)}
      >
        &times;
      </button>
    </div>
    
    <img 
      src={previewImage} 
      alt="Full Screen Preview" 
      className="max-w-[85%] max-h-[85%] object-contain shadow-2xl"
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
    />
  </div>
)}
      </div>
    </div>
  );
};

export default EmployeeDetails;