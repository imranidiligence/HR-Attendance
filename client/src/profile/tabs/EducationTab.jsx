import React, { useContext, useEffect, useState } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import {
  getEducation,
  addEducations,
  updateEducation,
  deleteEducation,
} from "../../../api/profile";
import { emptyEducation } from "../../constants/emptyData";
import { FaPencilAlt } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { toast } from "react-hot-toast"; 
import { AuthContext } from "../../context/AuthContextProvider";

const EducationTab = ({ isEditing, setIsEditing }) => {
  const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;
const {token} =  useContext(AuthContext)
  const [draft, setDraft] = useState({ ...emptyEducation });
  const [savedEducation, setSavedEducation] = useState([]);
  

  const [errors, setErrors] = useState({});


  const fetchEducation = async () => {
    try {
      const res = await getEducation(emp_id);
      setSavedEducation(res?.data?.education || []);
      setDraft({ ...emptyEducation }); 
      setErrors({});
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEducation();
  }, [emp_id,token]);

 
  const handleChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    // Clear specific error when user types
    if (errors[key]) {
      const updatedErrors = { ...errors };
      delete updatedErrors[key];
      setErrors(updatedErrors);
    }
  };

 
  const handleSave = async () => {
    const newErrors = {};

    // Validate all fields in the draft
    Object.keys(emptyEducation).forEach((key) => {
      // We skip "id" as it's not a user-input field
      if (key !== "id") {
        if (!draft[key] || draft[key].toString().trim() === "") {
          const fieldName = key.replace(/_/g, " ").toUpperCase();
          newErrors[key] = `${fieldName} IS REQUIRED`;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill all required fields");
      return;
    }

    try {
      if (draft.id) {
        await updateEducation(emp_id, draft.id, draft);
      } else {
        await addEducations(emp_id, draft);
      }

      await fetchEducation();
      toast.success("Education saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save education");
    }
  };

  
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this education?")) return;
    try {
      await deleteEducation(emp_id, id);
      fetchEducation();
      toast.success("Deleted successfully");
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const handleEdit = (edu) => {
    setDraft({ ...emptyEducation, ...edu });
    setErrors({}); 
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft({ ...emptyEducation });
    setErrors({}); // Clear error messages
    setIsEditing(false);
  };

  return (
    <>
      
      <FormCard>
        {Object.keys(emptyEducation).map((key) => (
          <div key={key} className="flex flex-col mb-3">
            <Input
              label={key.replace(/_/g, " ").toUpperCase()}
              value={draft[key] || ""}
              disabled={!isEditing}
              onChange={(e) => handleChange(key, e.target.value)}
            />
            {/* Specific Field Error Message */}
            {isEditing && errors[key] && (
              <p className="text-red-500 text-[10px] font-small mt-2 uppercase tracking-wide">
                * {errors[key]}
              </p>
            )}
          </div>
        ))}
      </FormCard>

      {isEditing && (
        <div className="flex gap-3 mt-3">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            onClick={handleCancel}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      )}

      {/* ================= TABLE ================= */}
      <div className="overflow-x-auto mt-6">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border px-4 py-3 font-semibold text-left">Degree</th>
              <th className="border px-4 py-3 font-semibold text-left">Field</th>
              <th className="border px-4 py-3 font-semibold text-left">Institute</th>
              <th className="border px-4 py-3 font-semibold text-left">Passing Year</th>
              <th className="border px-4 py-3 font-semibold text-left">Percentage</th>
              <th className="border px-4 py-3 font-semibold text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {savedEducation.length ? (
              savedEducation.map((edu) => (
                <tr key={edu.id} className="hover:bg-gray-50 transition-colors">
                  <td className="border px-4 py-2">{edu.degree}</td>
                  <td className="border px-4 py-2">{edu.field_of_study}</td>
                  <td className="border px-4 py-2">{edu.university}</td>
                  <td className="border px-4 py-2">{edu.passing_year}</td>
                  <td className="border px-4 py-2">{edu.percentage_or_grade}</td>
                  <td className="border px-4 py-2">
                    <button
                      className="text-blue-600 mr-3 hover:text-blue-800"
                      onClick={() => handleEdit(edu)}
                    >
                      <FaPencilAlt size={15} />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-800"
                      onClick={() => handleDelete(edu.id)}
                    >
                      <MdDelete size={20} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="border px-4 py-4 text-center text-gray-400"
                >
                  No education data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default EducationTab;