import React, { useState } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import { toast } from "react-hot-toast";
import { addBank } from "../../../api/profile";
import { AuthContext } from "../../context/AuthContextProvider";

const AddBankTab = ({ isEditing, setIsEditing }) => {
  const [draft, setDraft] = useState(
    {
      Account_holder_name : ""
    }
  );
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
  };

  const handleCancel = () => {
    setErrors([]);
    setIsEditing(false);
  };

  if (loading && draft.length === 0) {
    return (
      <div className="p-10 text-center text-gray-500">
        Loading bank details...
      </div>
    );
  }

  // console.log("draft",draft)
  return (
    <div className="flex flex-col gap-6 w-full">
      <FormCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <div className="flex flex-col w-full">
            <Input
              label=""
              value=""
              disabled={!isEditing}
              className="w-full capitalized"
            />
            {isEditing && errors && (
              <p className="text-red-500 text-[10px] font-bold mt-1 italic uppercase">
                * {errors}
              </p>
            )}
          </div>
        </div>
      </FormCard>

      {isEditing && (
        <div className="flex justify-end gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <button
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2 bg-[#222F7D] text-white rounded-lg hover:bg-blue-900 shadow-md transition-all font-medium"
            onClick={handleSave}
          >
            Save Bank Details
          </button>
        </div>
      )}
    </div>
  );
};

export default AddBankTab;
