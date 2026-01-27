import React, { useContext, useEffect, useState } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import { getContact, updateContact } from "../../../api/profile";
import { emptyContact } from "../../constants/emptyData";
import { toast } from "react-hot-toast";
import { AuthContext } from "../../context/AuthContextProvider";

const ContactsTab = ({ isEditing, setIsEditing }) => {
  const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;
  const {token} = useContext(AuthContext)
  const [draft, setDraft] = useState([]);
  const [originalDraft, setOriginalDraft] = useState([{ ...emptyContact }]);
  
  // Track errors as an array of objects (one for each contact card)
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!emp_id) return;

    const fetchContacts = async () => {
      try {
        const res = await getContact(emp_id);
        const contacts = res?.data?.contacts || [];

        if (contacts.length > 0) {
          const mapped = contacts.map((c) => ({
            contact_type: c.contact_type ?? "",
            phone: c.phone ?? "",
            email: c.email ?? "",
            relation: c.relation ?? "",
            isPrimary: c.is_primary ?? false,
            id: c.id,
          }));
        
          setDraft(mapped);
          setOriginalDraft(mapped);
        } else {
          const emptyRow = [{ ...emptyContact }];
          setDraft(emptyRow);
          setOriginalDraft(emptyRow);
        }
        
      } catch (error) {
        console.error(error);
        const emptyRow = [{ ...emptyContact }];
        setDraft(emptyRow);
        setOriginalDraft(emptyRow);
      }
    };

    fetchContacts();
  }, [emp_id,token]);

  const handleSave = async () => {
    let hasErrors = false;
    const newErrors = [];
  
    // 1. Validation Logic
    draft.forEach((contact, index) => {
      const contactErrors = {};
      Object.keys(emptyContact).forEach((key) => {
        if (key !== "id" && key !== "isPrimary") {
          if (!contact[key] || contact[key].toString().trim() === "") {
            const fieldLabel = key.replace(/_/g, " ").toUpperCase();
            contactErrors[key] = `${fieldLabel} IS REQUIRED`;
            hasErrors = true;
          }
        }
      });
      newErrors[index] = contactErrors;
    });
  
    if (hasErrors) {
      setErrors(newErrors);
      toast.error("Please fill all required fields");
      return;
    }
  
    try {
      // 2. Loop through and send updates
      for (const contact of draft) {
        const payload = {
          contact_type: contact.contact_type,
          phone: contact.phone,
          email: contact.email, // Backend uses this to find the record
          relation: contact.relation,
          is_primary: !!contact.isPrimary, // Force boolean (fix for undefined)
        };
  
        console.log("Sending payload:", payload);
        
       
        await updateContact(emp_id, payload); 
      }
  
      toast.success("Contacts saved successfully");
      setOriginalDraft(draft);
      setErrors([]);
      setIsEditing(false);
    } catch (error) {
      console.error("Save Error:", error);
      toast.error("Failed to save contacts");
    }
  };
  const handleCancel = () => {
    setDraft(originalDraft);
    setErrors([]); // Clear errors
    setIsEditing(false);
  };

  return (
    <>
      {draft.map((c, index) => (
        <FormCard key={c.id || index}>
          {Object.keys(emptyContact).map((key) => (
            <div key={key} className="flex flex-col mb-3">
              <Input
                label={key.replace(/_/g, " ").toUpperCase()}
                type={key === "isPrimary" ? "checkbox" : "text"}
                value={key === "isPrimary" ? undefined : c[key] || ""}
                checked={key === "isPrimary" ? c.isPrimary : undefined}
                disabled={!isEditing}
                onChange={(e) => {
                  // Update Draft
                  const copy = [...draft];
                  copy[index][key] =
                    key === "isPrimary" ? e.target.checked : e.target.value;
                  setDraft(copy);

                  // Clear specific error on change
                  if (errors[index]?.[key]) {
                    const errorCopy = [...errors];
                    delete errorCopy[index][key];
                    setErrors(errorCopy);
                  }
                }}
              />
              
              {/* Individual Field Error Message */}
              {isEditing && errors[index]?.[key] && (
                <p className="text-red-500 text-[10px] font-bold mt-1 uppercase tracking-wide">
                  * {errors[index][key]}
                </p>
              )}
            </div>
          ))}
        </FormCard>
      ))}

      {isEditing && (
        <div className="flex gap-3 mt-3">
          <button
            className="px-4 py-2 bg-gray-200 rounded"
            onClick={handleCancel}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      )}
    </>
  );
};

export default ContactsTab;