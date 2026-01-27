import React, { useContext, useEffect, useState } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import {
  getExperience,
  addExperienceses,
  updateExperience,
  deleteExperience,
} from "../../../api/profile";
import { emptyExperience } from "../../constants/emptyData";
import { FaPencilAlt } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { toast } from "react-hot-toast"; // Ensure this is imported
import { AuthContext } from "../../context/AuthContextProvider";

const ExperienceTab = ({ isEditing, setIsEditing }) => {
  const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;
const {token} =  useContext(AuthContext)
  const [draft, setDraft] = useState({ ...emptyExperience });
  const [savedExperience, setSavedExperience] = useState([]);
  
  // State for specific field errors
  const [errors, setErrors] = useState({});

  
  const toInputDate = (date) =>
    date ? new Date(date).toISOString().slice(0, 10) : "";

  const toDBDate = (date) => (date ? new Date(date).toISOString() : null);

  const formatDateDDMMYYYY = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  
  const fetchExperience = async () => {
    try {
      const res = await getExperience(emp_id);

      const data =
        res?.data?.experience?.map((e) => ({
          id: e.id,
          companyName: e.company_name || "",
          designation: e.designation || "",
          start_date: toInputDate(e.start_date),
          end_date: toInputDate(e.end_date),
          total_years: e.total_years || "",
        })) || [];

      setSavedExperience(data);
      setDraft({ ...emptyExperience });
      setErrors({}); // Clear errors on fresh fetch
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchExperience();
  }, [emp_id,token]);

 
  const handleChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      const updatedErrors = { ...errors };
      delete updatedErrors[key];
      setErrors(updatedErrors);
    }
  };

  const handleSave = async () => {
    const newErrors = {};

    // Validate all required fields
    Object.keys(emptyExperience).forEach((key) => {
      // Skip ID as it's not a user input
      if (key !== "id") {
        if (!draft[key] || draft[key].toString().trim() === "") {
          const fieldLabel = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toUpperCase();
          newErrors[key] = `${fieldLabel} IS REQUIRED`;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const payload = {
        company_name: draft.companyName,
        designation: draft.designation,
        start_date: toDBDate(draft.start_date),
        end_date: toDBDate(draft.end_date),
        total_years: draft.total_years || null,
      };

      if (draft.id) {
        await updateExperience(emp_id, draft.id, payload);
      } else {
        await addExperienceses(emp_id, payload);
      }

      await fetchExperience();
      setIsEditing(false);
      toast.success("Experience saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save experience");
    }
  };


  const handleDelete = async (id) => {
    if (!window.confirm("Delete this experience?")) return;
    try {
      await deleteExperience(emp_id, id);
      fetchExperience();
      toast.success("Experience deleted");
    } catch (error) {
      toast.error("Delete failed");
    }
  };


  const handleEdit = (exp) => {
    setDraft({ ...emptyExperience, ...exp });
    setErrors({}); // Clear any previous errors
    setIsEditing(true);
  };


  const handleCancel = () => {
    setDraft({ ...emptyExperience });
    setErrors({});
    setIsEditing(false);
  };

  return (
    <>

      <FormCard>
        {Object.keys(emptyExperience).map((key) => (
          <div key={key} className="flex flex-col mb-3">
            <Input
              label={key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toUpperCase()}
              value={draft[key] || ""}
              disabled={!isEditing}
              onChange={(e) => handleChange(key, e.target.value)}
            />
            {/* Specific Field Name Error Message */}
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


      <div className="overflow-x-auto mt-6">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="border px-4 py-3 font-semibold text-left">Company</th>
              <th className="border px-4 py-3 font-semibold text-left">Designation</th>
              <th className="border px-4 py-3 font-semibold text-left">Start Date</th>
              <th className="border px-4 py-3 font-semibold text-left">End Date</th>
              <th className="border px-4 py-3 font-semibold text-left">Total Years</th>
              <th className="border px-4 py-3 font-semibold text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {savedExperience.length ? (
              savedExperience.map((exp, i) => (
                <tr key={exp.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border px-4 py-2">{exp.companyName}</td>
                  <td className="border px-4 py-2">{exp.designation}</td>
                  <td className="border px-4 py-2">{formatDateDDMMYYYY(exp.start_date)}</td>
                  <td className="border px-4 py-2">{formatDateDDMMYYYY(exp.end_date)}</td>
                  <td className="border px-4 py-2">{Number(exp.total_years)}</td>
                  <td className="border px-4 py-2">
                    <button
                      className="text-blue-600 mr-3 hover:text-blue-800"
                      onClick={() => handleEdit(exp)}
                    >
                      <FaPencilAlt size={15} />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-800"
                      onClick={() => handleDelete(exp.id)}
                    >
                      <MdDelete size={20} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="border px-4 py-4 text-center text-gray-400"
                >
                  No experience data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default ExperienceTab;