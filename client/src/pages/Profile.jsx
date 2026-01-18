import React, { useState } from "react";
import { Typography, Divider } from "@mui/material";
import profileImg from "../assets/avatar.webp";
import { IoHomeSharp } from "react-icons/io5";
import { MdOutlineEmail } from "react-icons/md";
import Input from "../components/Input";
import Select from "../components/Select";
import FormCard from "../components/FormCard";

/* ---------------- CONSTANTS ---------------- */

const emptyEducation = {
  degree: "",
  field: "",
  institution: "",
  passingYear: "",
};

const emptyExperience = {
  companyName: "",
  designation: "",
  employmentType: "",
  TotalYears: "",
  responsibilities: "",
  location: "",
};

/* ---------------- HELPERS ---------------- */

const isExperienceEmpty = (exp) =>
  Object.values(exp).every(
    (val) => val === "" || val === null || val === undefined
  );

const removeExperience = (index) => {
  setDraftExperience((prev) =>
    prev.filter((_, i) => i !== index)
  );
};

/* ---------------- COMPONENT ---------------- */

const Profile = () => {
  const user = JSON.parse(localStorage.getItem("user"));

  const tabs = [
    "Organization",
    "Personal Details",
    "Education",
    "Experience",
    "Contacts",
    "Bank",
  ];

  const [activeTab, setActiveTab] = useState("Organization");
  const [isEditing, setIsEditing] = useState(false);

  /* ---------------- ORG ---------------- */
  const [orgData, setOrgData] = useState({
    empCode: "EMP1023",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@abctech.com",
    joiningDate: "2021-06-15",
    designation: "Engineer",
    department: "IT",
    officeLocation: "Patel Arcade 2,Juna Bazar,City Chowk Chh.Sambhaji Nagar",
  });
  const [draftOrg, setDraftOrg] = useState(orgData);

  /* ---------------- PERSONAL ---------------- */
  const [personalData, setPersonalData] = useState({
    gender: "Male",
    dob: "1996-08-17",
    bloodGroup: "O+",
    maritalStatus: "Single",
    nationality: "Indian",
    address: "Bangalore",
    aadharNumber: "1665624984",
    Nominee: "",
  });
  const [draftPersonal, setDraftPersonal] = useState(personalData);

  /* ---------------- EDUCATION ---------------- */
  const [educationData, setEducationData] = useState([
    { ...emptyEducation, degree: "B.Tech", field: "CSE" },
  ]);
  const [draftEducation, setDraftEducation] = useState(educationData);

  /* ---------------- EXPERIENCE ---------------- */
  const [experienceData, setExperienceData] = useState([
    {
      ...emptyExperience,
      companyName: "XYZ Solutions",
      designation: "Frontend Engineer",
    },
  ]);
  const [draftExperience, setDraftExperience] = useState(experienceData);

  /* ---------------- CONTACT ---------------- */
  const [contactsData, setContactsData] = useState([
    {
      contactType: "Emergency",
      phone: "9999999999",
      email: "",
      relation: "Father",
      isPrimary: true,
    },
  ]);
  const [draftContact, setDraftContact] = useState(contactsData);

  /* ---------------- BANK ---------------- */
  const [draftBank, setDraftBank] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    branchName: "",
    accountType: "",
    panNumber: "",
    upiId: "",
  });

  /* ---------------- ACTIONS ---------------- */

  const startEdit = () => {
    setDraftOrg(orgData);
    setDraftPersonal(personalData);
    setDraftEducation(educationData);
    setDraftExperience(experienceData);
    setDraftContact(contactsData);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraftExperience(experienceData); // restore saved
    setDraftEducation(educationData)
    setIsEditing(false);
  };

  const saveEdit = () => {
    const cleanedExperience = draftExperience.filter(
      (exp) => !isExperienceEmpty(exp)
    );
    const cleanedEducation = draftEducation.filter(
      (exp) => !isExperienceEmpty(exp)
    );

    setOrgData(draftOrg);
    setPersonalData(draftPersonal);
    setEducationData(cleanedEducation);
    setDraftEducation(cleanedEducation);
    setExperienceData(cleanedExperience);
    setDraftExperience(cleanedExperience);
    setContactsData(draftContact);
    setIsEditing(false);
  };

  const addEducation = () =>
    setDraftEducation((prev) => [...prev, { ...emptyEducation }]);

  const addExperience = () =>
    setDraftExperience((prev) => [...prev, { ...emptyExperience }]);



  return (
    <div className="min-h-screen py-6 px-4">
      <div className="sticky left-0 top-0 bg-[#222F7D] rounded-xl py-2 mb-6 shadow-lg">
        <Typography className="text-white text-2xl text-center font-bold">
          Employee Profile
        </Typography>
      </div>

      {/* HEADER */}
      <div className=" mx-auto grid md:grid-cols-[4fr_1fr] gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="grid md:grid-cols-4 gap-6 items-center">
            <img
              src={profileImg}
              className="w-32 h-32 rounded-full mx-auto border-4 border-[#222F7D]"
            />
            <div className="md:col-span-3">
              <h2 className="text-xl font-semibold">{user?.name}</h2>
              <p className="text-gray-600">{user?.role}</p>
              <div className="flex gap-6 mt-2 text-gray-600">
                <span className="flex items-center gap-1">
                  <IoHomeSharp /> {orgData.officeLocation}
                </span>
                <span className="flex items-center gap-1">
                  <MdOutlineEmail /> {user?.email}
                </span>
              </div>
            </div>
          </div>
          <Divider className="my-4" />
        </div>
      </div>

      {/* TABS */}
      <div className="flex justify-between bg-[#222F7D] px-4 py-2 rounded  mx-auto mt-4">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setIsEditing(false);
              }}
              className={
                activeTab === tab ? "text-white" : "text-slate-300"
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {!isEditing && (
          <button
            onClick={startEdit}
            className="bg-white px-4 py-1 rounded text-sm"
          >
            Edit
          </button>
        )}
      </div>

      {/* Organization */}
      <div className="mx-auto mt-4">
  {activeTab === "Organization" && (
    <FormCard title="Organization Details">

      <Input
        label="First Name"
        value={draftOrg.firstName}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftOrg({ ...draftOrg, firstName: e.target.value })
        }
      />

      <Input
        label="Last Name"
        value={draftOrg.lastName}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftOrg({ ...draftOrg, lastName: e.target.value })
        }
      />

      <Input
        label="Employee Code"
        value={draftOrg.empCode}
        disabled
      />

      <Input
        label="Joining Date"
        type="date"
        value={draftOrg.joiningDate}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftOrg({ ...draftOrg, joiningDate: e.target.value })
        }
      />

      <Input
        label="Designation"
        value={draftOrg.designation}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftOrg({ ...draftOrg, designation: e.target.value })
        }
      />

      <Input
        label="Department"
        value={draftOrg.department}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftOrg({ ...draftOrg, department: e.target.value })
        }
      />

      <Input
        label="Office Location"
        value={draftOrg.officeLocation}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftOrg({ ...draftOrg, officeLocation: e.target.value })
        }
      />

    </FormCard>
  )}
</div>
{activeTab === "Personal Details" && (
  <FormCard title="Personal Information">
    <Select
      label="Gender"
      value={draftPersonal.gender}
      disabled={!isEditing}
      options={["Male", "Female", "Other"]}
      onChange={(e) =>
        setDraftPersonal({ ...draftPersonal, gender: e.target.value })
      }
    />

    <Input
      label="Date of Birth"
      type="date"
      value={draftPersonal.dob}
      disabled={!isEditing}
      onChange={(e) =>
        setDraftPersonal({ ...draftPersonal, dob: e.target.value })
      }
    />

    <Input
      label="Blood Group"
      value={draftPersonal.bloodGroup}
      disabled={!isEditing}
      onChange={(e) =>
        setDraftPersonal({ ...draftPersonal, bloodGroup: e.target.value })
      }
    />

    <Select
      label="Marital Status"
      value={draftPersonal.maritalStatus}
      disabled={!isEditing}
      options={["Single", "Married"]}
      onChange={(e) =>
        setDraftPersonal({
          ...draftPersonal,
          maritalStatus: e.target.value,
        })
      }
    />

    <Input
      label="Nationality"
      value={draftPersonal.nationality}
      disabled={!isEditing}
      onChange={(e) =>
        setDraftPersonal({ ...draftPersonal, nationality: e.target.value })
      }
    />

    <Input
      label="Address"
      value={draftPersonal.address}
      disabled={!isEditing}
      onChange={(e) =>
        setDraftPersonal({ ...draftPersonal, address: e.target.value })
      }
    />
  </FormCard>
)}



      {/* Education */}
      <div className=" mx-auto mt-4">
        {activeTab === "Education" && (
          <>
            {draftEducation.map((edu, i) => (
              <FormCard key={i} title={`Education ${i + 1}`}>
               

                {Object.keys(emptyEducation).map((key) => (
                  <Input
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1")}
                    value={edu[key]}
                    disabled={!isEditing}
                    onChange={(e) => {
                      const updated = [...draftEducation];
                      updated[i] = { ...updated[i], [key]: e.target.value };
                      setDraftEducation(updated);
                    }}
                  />
                ))}
              </FormCard>
            ))}

            {isEditing && (
              <button
                onClick={addEducation}
                className="text-blue-600 text-sm mt-2"
              >
                ➕ Add Education
              </button>
            )}
          </>
        )}
         {/* Remove (except first) */}
                {/* {isEditing && i !== 0 && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => removeItem(setDraftEducation)(i)}
                      className="text-red-600 text-sm"
                    >
                      🗑️ Remove
                    </button>
                  </div>
                )} */}
      </div>

      {/* EXPERIENCE */}
      <div className=" mx-auto mt-4">
        {activeTab === "Experience" && (
          <>
            {draftExperience.map((exp, i) => (
              <FormCard key={i} title={`Experience ${i + 1}`}>


                {Object.keys(emptyExperience).map((key) => (
                  <Input
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1")}
                    value={exp[key]}
                    disabled={!isEditing}
                    onChange={(e) => {
                      const updated = [...draftExperience];
                      updated[i] = {
                        ...updated[i],
                        [key]: e.target.value,
                      };
                      setDraftExperience(updated);
                    }}
                  />
                ))}
              </FormCard>
            ))}

            {isEditing && (
              <button
                onClick={addExperience}
                className="text-blue-600 text-sm mt-2"
              >
                ➕ Add Experience
              </button>
            )}
          </>
        )}


        {/* {isEditing && (
          <div className="flex justify-end gap-4 mt-6">
            <button onClick={cancelEdit} className="border px-4 py-2 rounded">
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="bg-[#222F7D] text-white px-4 py-2 rounded"
            >
              Save
            </button>
          </div>
        )} */}
      </div>

      {/* Contact */}
      <div className=" mx-auto mt-4">
  {activeTab === "Contacts" && (
    <>
      {draftContact.map((c, i) => (
        <FormCard key={i} title={`Contact ${i + 1}`}>
          <Input
            label="Contact Type"
            value={c.contactType}
            disabled={!isEditing}
            onChange={(e) => {
              const updated = [...draftContact];
              updated[i] = {
                ...updated[i],
                contactType: e.target.value,
              };
              setDraftContact(updated);
            }}
          />

          <Input
            label="Phone"
            value={c.phone}
            disabled={!isEditing}
            onChange={(e) => {
              const updated = [...draftContact];
              updated[i] = { ...updated[i], phone: e.target.value };
              setDraftContact(updated);
            }}
          />

          <Input
            label="Email"
            value={c.email}
            disabled={!isEditing}
            onChange={(e) => {
              const updated = [...draftContact];
              updated[i] = { ...updated[i], email: e.target.value };
              setDraftContact(updated);
            }}
          />

          <Input
            label="Relation"
            value={c.relation}
            disabled={!isEditing}
            onChange={(e) => {
              const updated = [...draftContact];
              updated[i] = { ...updated[i], relation: e.target.value };
              setDraftContact(updated);
            }}
          />

          <Select
            label="Primary Contact"
            value={c.isPrimary ? "Yes" : "No"}
            options={["Yes", "No"]}
            disabled={!isEditing}
            onChange={(e) => {
              const updated = [...draftContact];
              updated[i] = {
                ...updated[i],
                isPrimary: e.target.value === "Yes",
              };
              setDraftContact(updated);
            }}
          />
        </FormCard>
      ))}
    </>
  )}
 
</div>


      {/* Bank */ } <div className=" mx-auto mt-4">
  {activeTab === "Bank" && (
    <FormCard title="Bank Details">

      <Input
        label="Account Holder Name"
        value={draftBank.accountHolderName}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            accountHolderName: e.target.value,
          })
        }
      />

      <Input
        label="Bank Name"
        value={draftBank.bankName}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            bankName: e.target.value,
          })
        }
      />

      <Input
        label="Account Number"
        value={draftBank.accountNumber}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            accountNumber: e.target.value,
          })
        }
      />

      <Input
        label="IFSC Code"
        value={draftBank.ifscCode}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            ifscCode: e.target.value,
          })
        }
      />

      <Input
        label="Branch Name"
        value={draftBank.branchName}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            branchName: e.target.value,
          })
        }
      />

      
      <Select
        label="Account Type"
        value={draftBank.accountType}
        disabled={!isEditing}
        options={["Savings", "Current"]}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            accountType: e.target.value,
          })
        }
      />

      <Input
        label="UPI ID (Optional)"
        value={draftBank.upiId}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            upiId: e.target.value,
          })
        }
      />

   
      <Input
        label="PAN Number"
        value={draftBank.panNumber}
        disabled={!isEditing}
        onChange={(e) =>
          setDraftBank({
            ...draftBank,
            panNumber: e.target.value,
          })
        }
      />

    </FormCard>
  )}
</div>
{isEditing && (
          <div className="flex justify-end gap-4 mt-6">
            <button onClick={cancelEdit} className="border px-4 py-2 rounded">
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="bg-[#222F7D] text-white px-4 py-2 rounded"
            >
              Save
            </button>
          </div>
        )}

    </div >
  );
};

export default Profile;
