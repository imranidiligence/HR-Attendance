import React, { useState } from "react";
import OrganizationTab from "./tabs/OrganizationTab";
import PersonalTab from "./tabs/PersonalTab";
import EducationTab from "./tabs/EducationTab";
import ExperienceTab from "./tabs/ExperienceTab";
import ContactsTab from "./tabs/ContactTab";
import BankTab from "./tabs/BankTab";
import DocumentTab from "./tabs/DocumentTab";
const tabs = ["Organization", "Personal", "Education", "Experience", "Contacts", "Bank", "Documents"];

const MainProfile = () => {
  const [activeTab, setActiveTab] = useState("Organization");
  const [isEditing, setIsEditing] = useState(false);

  const startEdit = () => setIsEditing(true);
  const cancelEdit = () => setIsEditing(false);

  return (
    <div>
      {/* Tabs */}
      <div className="flex justify-between bg-[#222F7D] px-4 py-2 rounded mx-auto mt-4">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setIsEditing(false);
              }}
              className={activeTab === tab ? "text-[#222F7D] bg-white rounded-md px-2 py-2 " : "text-slate-300"}
            >
              {tab}
            </button>
          ))}
        </div>

        {!isEditing && activeTab !== "Organization" && (
          <button onClick={startEdit} className="bg-white px-4 py-1 rounded text-sm">
            Edit
          </button>
        )}
      </div>


      {/* Tabs Content */}
      {activeTab === "Organization" && <OrganizationTab />}
      {activeTab === "Personal" && (
        <PersonalTab isEditing={isEditing} setIsEditing={setIsEditing} cancelEdit={cancelEdit} />
      )}
      {activeTab === "Education" && (
        <EducationTab setIsEditing={setIsEditing} isEditing={isEditing} cancelEdit={cancelEdit} />
      )}
      {activeTab === "Experience" && (
        <ExperienceTab setIsEditing={setIsEditing} isEditing={isEditing} cancelEdit={cancelEdit} />
      )}
      {activeTab === "Contacts" && (
        <ContactsTab setIsEditing={setIsEditing} isEditing={isEditing} cancelEdit={cancelEdit} />
      )}
      {activeTab === "Bank" && (
        <BankTab setIsEditing={setIsEditing} isEditing={isEditing} cancelEdit={cancelEdit} />
      )}

      {activeTab === "Documents" && (
        <DocumentTab
          // draftBank={draftBank}
          // setDraftBank={setDraftBank}
          isEditing={isEditing}
          setIsEditing={setIsEditing}


        />

      )}
    </div>
  );
};

export default MainProfile;
