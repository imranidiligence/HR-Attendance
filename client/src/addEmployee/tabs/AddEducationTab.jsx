import React, { useEffect, useState } from "react";
import {
  addEducations,
  updateEducation,
  deleteEducation,
  getEducation,
} from "../../../api/profile";
import { emptyEducation, degreeOptions } from "../../constants/emptyData";
import { FaPencilAlt, FaCheck, FaTimes } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { toast } from "react-hot-toast";
import api from "../../../api/axiosInstance";

const AddEducationTab = ({
  educationData,
  onSave,
  empId,
  isAddingNew,
  setIsAddingNew,
}) => {
  const [educationList, setEducationList] = useState([]);
const [draft, setDraft] = useState(null);
  // const [draft, setDraft] = useState([educationData]);
  const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  /* ================= CHANGE ================= */

  useEffect(()=>{
    console.log("Education Data",educationData);
console.log("empId",empId);
  },[])
  
useEffect(() => {
  if (!empId) return;

  const fetchEducation = async () => {
    try {
      const resp = await getEducation(empId);
      const education = resp?.data?.education;

      console.log("education data",education);

      if (Array.isArray(education) && education.length > 0) {
        // setDraft(education);
        setEducationList(education);
      } else {
        setEducationList(emptyEducation);
      }

    } catch (error) {
      console.error("Error fetching education:", error);
      // setDraft([emptyEducation]);
      setEducationList([]);
    }
  };

  fetchEducation();
}, [empId]);

// console.log("educationList",educationList);

  const handleChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  /* ================= EDIT ================= */

// const handleEdit = (education, index) => {

//   if (editingIndex === index) {
//     // Clicking same row → cancel edit
//     setEditingIndex(null);
//     setDraft(emptyEducation);
//     return;
//   }

//   if (editingIndex !== null) {
//     toast.error("Please save or cancel current changes first");
//     return;
//   }

//   setEditingIndex(index);
//   setDraft({ ...emptyEducation, ...education });
// };
const handleEdit = (education, index) => {
  if (editingIndex === index) {
    setEditingIndex(null);
    setDraft(null);
    return;
  }

  if (editingIndex !== null) {
    toast.error("Please save or cancel current changes first");
    return;
  }

  setEditingIndex(index);
  setDraft({ ...education });
};
  /* ================= CANCEL ================= */

  const handleCancel = () => {
    setDraft(null);
    setEditingIndex(null);
    setIsAddingNew(false);
  };

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (!draft) return;

    const toastId = toast.loading("Saving education details...");

    try {
      const formData = new FormData();
      formData.append("education", JSON.stringify([draft]));

      if (draft.marksheet_file) {
        formData.append("file_0", draft.marksheet_file);
      }

      if (draft.id) {
        await updateEducation(empId, draft.id, formData);
        toast.success("Education updated", { id: toastId });
      } else {
        await addEducations(empId, formData);
        toast.success("New education added", { id: toastId });
    }

      setDraft(null);
      setEditingIndex(null);
      setIsAddingNew(false);

      if (onSave) await onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed", {
        id: toastId,
      });
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;

    const toastId = toast.loading("Deleting record...");
    try {
      await deleteEducation(empId, id);
      toast.success("Deleted", { id: toastId });
      if (onSave) await onSave();
    } catch {
      toast.error("Delete failed", { id: toastId });
    }
  };

  /* ================= AUTO NEW ROW ================= */

  useEffect(() => {
    if (isAddingNew) {
      setEditingIndex("new");
      setDraft({ ...emptyEducation });
    }
  }, [isAddingNew]);

  /* ================= UI ================= */

  return (
    <div className="container-fluid">
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium" >Degree</th>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium">Field of Study</th>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium">Institution</th>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium" >Year</th>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium">University</th>
                <th className="px-4 py-2 text-center text-sm text-gray-600 mb-1 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {educationList?.map((edu, index) =>
                editingIndex === index ? (
                  <EditableRow
                    key={edu.id || index}
                    draft={draft}
                    onChange={handleChange}
                    onSave={handleSave}
                    onCancel={handleCancel}
                  />
                ) : (
                  <tr key={edu.id || index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600">{edu.degree}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{edu.field_of_study}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{edu.institution_name}</td>
                    <td className="p-3 text-sm text-gray-600">{edu.passing_year}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{edu.university}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 text-center">
                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={() => handleEdit(edu, index)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <FaPencilAlt />
                        </button>

                        <button
                          onClick={() => handleDelete(edu.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <MdDelete size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {editingIndex === "new" && draft && (
                <EditableRow
                  draft={draft}
                  onChange={handleChange}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              )}

              {(!draft || draft.length === 0) &&
                !isAddingNew && (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-sm text-gray-600 italic bg-gray-50">
                      No Education records found
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ================= EDITABLE ROW ================= */

const EditableRow = ({ draft, onChange, onSave, onCancel }) => (
  <tr className="bg-blue-50/30">
    <td className="p-2 text-sm text-gray-600" style={{width:"200px"}}>
      <select
        className="w-full border px-2 py-1 text-sm rounded"
        value={draft.degree || ""}
        onChange={(e) => onChange("degree", e.target.value)}
      >
        {degreeOptions.map((deg) => (
          <option key={deg} value={deg}>
            {deg}
          </option>
        ))}
      </select>
    </td>

    <td className="p-2 text-sm text-gray-600" style={{width:"150px"}}>
      <input
        className="w-full px-2 py-1.5 text-sm border rounded border-gray-300"
        value={draft.field_of_study || ""}
        onChange={(e) => onChange("field_of_study", e.target.value)}
      />
    </td>

    <td className="p-2 text-sm text-gray-600">
      <input
        className="w-full px-2 py-1.5 text-sm border rounded border-gray-300"
        value={draft.institution_name || ""}
        onChange={(e) => onChange("institution_name", e.target.value)}
      />
    </td>

    <td className="p-2 text-sm text-gray-600" style={{width:"70px"}}>
      <input
        className="px-2 w-full py-1.5 text-sm border rounded border-gray-300"
        
        value={draft.passing_year || ""}
        onChange={(e) => onChange("passing_year", e.target.value)}
      />
    </td>

    <td className="p-2">
      <input
        className="w-full px-2 py-1.5 text-sm border rounded border-gray-300"
        value={draft.university || ""}
        onChange={(e) => onChange("university", e.target.value)}
      />
    </td>

    <td className="p-2 text-sm text-gray-600">
      <div className="flex gap-4 justify-center">
        <button onClick={onSave} className="text-green-600">
          <FaCheck size={16} />
        </button>
        <button onClick={onCancel} className="text-orange-500">
          <FaTimes size={16} />
        </button>
      </div>
    </td>
  </tr>
);

export default AddEducationTab;