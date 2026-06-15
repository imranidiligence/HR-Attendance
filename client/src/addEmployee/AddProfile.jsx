import React, { useState } from "react";
import AddOrganizationTab from "./tabs/AddOrganizationTab";
import AddPersonalTab from "./tabs/AddPersonalTab";
import AddEducationTab from "./tabs/AddEducationTab";
import AddExperienceTab from "./tabs/AddExperienceTab";
import AddContactsTab from "./tabs/AddContactTab";
import AddBankTab from "./tabs/AddBankTab";
import AddDocumentTab from "./tabs/AddDocumentTab";
import AddNomineeTab from "./tabs/AddNomineeTab";

const tabs = [
  "Organization",
  "Personal",
  "Education",
  "Experience",
  "Contacts",
  "Nominees",
  "Bank",
  "Documents",
];

const MainProfile = ({ 
  personalData,
  educationData,
  experienceData,
  contactData,
  nomineeData,
  bankData,
  organizationData,
  userRole, // "admin" or "employee"
  isEditing,
  setIsEditing,
  onSave,
  empId, // The dynamic ID (from URL or LocalStorage)
  isAddingNew,
  setIsAddingNew,
}) => {
  const [activeTab, setActiveTab] = useState("Organization");

  // console.log("empId",empId);

  const isAdmin = userRole === "admin";
  const isOrganizationTab = activeTab === "Organization";


  // Admins can edit anything. Employees can edit anything except Organization.
  const canShowEditButton = !isEditing && !isAddingNew && (isAdmin || !isOrganizationTab);

  const cancelEdit = ()=>{
    setIsEditing(false)
  }

  return (
    <div>
      <div className="bg-[#222F7D] px-4 py-2 rounded-xl flex items-center justify-between gap-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setIsEditing(false); // Reset editing mode when switching tabs
                setIsAddingNew(false); // Reset adding new mode when switching tabs
              }}
              className={`whitespace-nowrap text-sm px-4 py-1.5 transition-all ${
                activeTab === tab
                  ? "bg-white text-[#222F7D] rounded-md font-bold"
                  : "text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {canShowEditButton &&
          (["Education", "Experience", "Contacts", "Documents"].includes(
            activeTab,
          ) ? (
            <button
              onClick={() => setIsAddingNew(true)}
              className="bg-white px-4 py-1.5 rounded-md text-sm font-medium text-[#222F7D] hover:bg-gray-100"
            >
              + Add New
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-white px-4 py-1.5 rounded-md text-sm font-medium text-[#222F7D] hover:bg-gray-100"
            >
              Edit Profile
            </button>
          ))}
      </div>

      <div className="mt-4">
          {activeTab === "Organization" && (
          <AddOrganizationTab
            organizationData={organizationData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onSave={onSave}
            empId={empId}
            personalData={personalData}
            cancelEdit={cancelEdit}
          />
        )}
        {activeTab === "Personal" && (
          <AddPersonalTab
            personalData={personalData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onSave={onSave}
            empId={empId}
          />
        )}

        {activeTab === "Education" && (
          <AddEducationTab
            educationData={educationData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onSave={onSave}
            empId={empId}
            isAddingNew={isAddingNew}
            setIsAddingNew={setIsAddingNew}
          />
        )}

        {activeTab === "Experience" && (
          <AddExperienceTab
            experienceData={experienceData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            empId={empId}
            onSave={onSave}
            isAddingNew={isAddingNew}
            setIsAddingNew={setIsAddingNew}
          />
        )}

        {activeTab === "Contacts" && (
          <AddContactsTab
            contactData={contactData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            empId={empId}
            onSave={onSave}
            isAddingNew={isAddingNew}
            setIsAddingNew={setIsAddingNew}
          />
        )}

        {activeTab === "Bank" && (
          <AddBankTab
            bankData={bankData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            empId={empId}
            onSave={onSave}
          />
        )}

        {activeTab === "Documents" && (
          <AddDocumentTab
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            empId={empId}
            onSave={onSave}
            isAddingNew={isAddingNew}
            setIsAddingNew={setIsAddingNew}
          />
        )}
        {activeTab === "Nominees" && (
          <AddNomineeTab
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            empId={empId}
            onSave={onSave}
            nomineData={nomineeData}
          />
        )}
      </div>
    </div>
  );
};

export default MainProfile;
