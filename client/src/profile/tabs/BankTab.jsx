import React, { useContext, useEffect, useState } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import { toast } from "react-hot-toast";
import { getBank, addBank, updateBank } from "../../../api/profile";
import { emptyBank } from "../../constants/emptyData";
import { AuthContext } from "../../context/AuthContextProvider";

const BankTab = ({ isEditing, setIsEditing }) => {
  const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;
const {token} = useContext(AuthContext)
  const [draft, setDraft] = useState([]);
  const [originalDraft, setOriginalDraft] = useState([{ ...emptyBank }]);
  
  // State to track errors for each bank entry
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!emp_id) return;

    const fetchBank = async () => {
      try {
        const res = await getBank(emp_id);
        const bankData = res?.data?.bankDetails;

        if (bankData?.length > 0) {
          const mapped = bankData.map((b) => ({
            ...emptyBank,
            account_holder_name: b.account_holder_name || "",
            bank_name: b.bank_name || "",
            account_number: b.account_number || "",
            ifsc_code: b.ifsc_code || "",
            branch_name: b.branch_name || "",
            account_type: b.account_type || "",
            upi_id: b.upi_id || "",
            pan_number: b.pan_number || "",
            is_active: b.is_active ?? true,
            id: b.id,
          }));

          setDraft(mapped);
          setOriginalDraft(mapped);
        } else {
          setDraft([{ ...emptyBank }]);
          setOriginalDraft([{ ...emptyBank }]);
        }
      } catch (error) {
        console.error("Failed to fetch bank details:", error);
        setDraft([{ ...emptyBank }]);
        setOriginalDraft([{ ...emptyBank }]);
      }
    };

    fetchBank();
  }, [emp_id,token]);

  const handleSave = async () => {
    let hasErrors = false;
    const newErrors = [];

    // Validation Logic
    draft.forEach((bank, index) => {
      const bankErrors = {};
      Object.keys(emptyBank).forEach((key) => {
        // Skip ID and is_active from required check
        if (key !== "id" && key !== "is_active") {
          if (!bank[key] || bank[key].toString().trim() === "") {
            const fieldLabel = key.replace(/_/g, " ").toUpperCase();
            bankErrors[key] = `${fieldLabel} IS REQUIRED`;
            hasErrors = true;
          }
        }
      });
      newErrors[index] = bankErrors;
    });

    if (hasErrors) {
      setErrors(newErrors);
      toast.error("Please fill all required bank fields");
      return;
    }

    try {
      for (const bank of draft) {
        bank.id
          ? await updateBank(emp_id, bank.id, bank)
          : await addBank(emp_id, bank);
      }

      toast.success("Bank details saved successfully");
      setOriginalDraft(draft);
      setErrors([]); // Reset errors
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save bank details");
    }
  };

  const handleCancel = () => {
    setDraft(originalDraft);
    setErrors([]); // Reset errors
    setIsEditing(false);
  };

  return (
    <>
      {draft.map((bank, index) => (
        <FormCard key={bank.id || index}>
          {Object.keys(emptyBank).map((key) => (
            <div key={key} className="flex flex-col">
              <Input
                label={key.replace(/_/g, " ").toUpperCase()}
                value={bank[key] || ""}
                disabled={!isEditing}
                onChange={(e) => {
                  const copy = [...draft];
                  copy[index][key] = e.target.value;
                  setDraft(copy);

                  // Clear error for this specific field on change
                  if (errors[index]?.[key]) {
                    const errorCopy = [...errors];
                    delete errorCopy[index][key];
                    setErrors(errorCopy);
                  }
                }}
              />
              {/* Validation Message */}
              {isEditing && errors[index]?.[key] && (
                <p className="text-red-500 text-[10px] font-small mt-2 uppercase tracking-wide">
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

export default BankTab;