import React, { useContext, useEffect, useState } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import { addPersonal, getPersonal, updatePersonal } from "../../../api/profile";
import { emptyPersonal } from "../../constants/emptyData";
import { toast } from "react-hot-toast";
import { AuthContext } from "../../context/AuthContextProvider";

const PersonalTab = ({ isEditing, setIsEditing }) => {
  const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;
  const {token} =  useContext(AuthContext)
  const [draft, setDraft] = useState({ ...emptyPersonal });
  const [originalDraft, setOriginalDraft] = useState({ ...emptyPersonal });
  const [isNewRecord, setIsNewRecord] = useState(false);
  // State to track specific field errors
  const [errors, setErrors] = useState({});


useEffect(() => {
  const storedUser = localStorage.getItem("user");
  const currentEmpId = storedUser ? JSON.parse(storedUser)?.emp_id : null;

  if (!currentEmpId || !token) return;

  const fetchPersonal = async () => {
    try {
      const res = await getPersonal(currentEmpId);
      const personalData = res?.data;
  
      const initializedData = {};
  
      // Loop through your expected keys (gender, dob, etc.)
      Object.keys(emptyPersonal).forEach((key) => {
        // Logic: If API value exists AND is not null, use it. 
        // Otherwise, use the dummy value from emptyPersonal.
        initializedData[key] = (personalData && personalData[key] !== null && personalData[key] !== undefined)
          ? personalData[key]
          : emptyPersonal[key]; // Use "Male", "B+", etc. from your dummy object
      });
  
      setDraft(initializedData);
      setOriginalDraft(initializedData);
      
      // Determine if we should POST or PUT later
      // If the API returned nulls for core fields, it's effectively a "New" record
      setIsNewRecord(!personalData?.aadharnumber); 
  
    } catch (error) {
      console.error("Fetch failed, using all dummy data", error);
      setDraft({ ...emptyPersonal });
      setOriginalDraft({ ...emptyPersonal });
      setIsNewRecord(true);
    }
  };

  fetchPersonal();
}, [token, emp_id]);




// useEffect(()=>{
//   console.log("isNewRecord",isNewRecord)
// },[isNewRecord])

const handleSave = async () => {
  const newErrors = {};
  
  // Validation
  Object.keys(emptyPersonal).forEach((key) => {
    if (!draft[key] || draft[key].toString().trim() === "") {
      const fieldName = key.replace(/_/g, " ").toUpperCase();
      newErrors[key] = `${fieldName} IS REQUIRED`;
    }
  });

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    toast.error("Please fix the errors below");
    return;
  }

  try {
    // Dynamic API call based on whether the record exists
    if (isNewRecord) {
      await addPersonal(emp_id, draft);
      setIsNewRecord(false); // It's no longer new after first save
    } else {
      await updatePersonal(emp_id, draft);
    }

    toast.success("Personal Data Saved");
    setOriginalDraft(draft);
    setErrors({}); 
    setIsEditing(false);
  } catch (error) {
    console.error(error);
    toast.error("Failed to save personal data");
  }
};

  const handleCancel = () => {
    setDraft(originalDraft); 
    setErrors({}); 
    setIsEditing(false);
  };

  return (
    <FormCard>
      {Object.keys(emptyPersonal).map((key) => (
        <div key={key} className="flex flex-col mb-3">
          <Input
            label={key.replace(/_/g, " ").toUpperCase()}
            value={draft[key] || ""}
            disabled={!isEditing}
            onChange={(e) => {
              setDraft({ ...draft, [key]: e.target.value });
              // Remove the specific error when user starts typing
              if (errors[key]) {
                const updatedErrors = { ...errors };
                delete updatedErrors[key];
                setErrors(updatedErrors);
              }
            }}
          />
          
      
          {isEditing && errors[key] && (
            <p className="text-red-500 text-[10px] font-small mt-2 uppercase tracking-wide ">
              * {errors[key]}
            </p>
          )}
        </div>
      ))}

      {isEditing && (
        <div className="flex gap-3 mt-3">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={handleCancel}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      )}
    </FormCard>
  );
};

export default PersonalTab;