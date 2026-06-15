import React, { useEffect, useState } from "react";
import {
  addExperienceses, //  FIXED NAME
  updateExperience,
  deleteExperience,
} from "../../../api/profile";
import { emptyExperience } from "../../constants/emptyData";
import { FaPencilAlt, FaCheck, FaTimes } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { toast } from "react-hot-toast";
import Loader from "../../components/Loader";

const AddExperienceTab = ({
  experienceData, // prevents crash
  isAddingNew,
  setIsAddingNew,
  empId,
  onSave,
}) => {
  const [draft, setDraft] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [loading, setLoading] = useState(false);


  // console.log("experienceData",experienceData);
  /* ================= DATE HELPERS ================= */

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d)) return date;
    return d.toLocaleDateString("en-GB");
  };

  const toInputDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return !isNaN(d) ? d.toISOString().split("T")[0] : "";
  };

  /* ================= HANDLE ADD NEW ================= */

  useEffect(() => {
    if (isAddingNew && !draft) {
      setEditingIndex("new");
      setDraft({ ...emptyExperience });
    }
  }, [isAddingNew]);

  /* ================= HANDLE CHANGE ================= */

  const handleChange = (key, value) => {
    setDraft((prev) => {
      const updated = { ...prev, [key]: value };

      if (
        (key === "start_date" || key === "end_date") &&
        updated.start_date &&
        updated.end_date
      ) {
        const start = new Date(updated.start_date);
        const end = new Date(updated.end_date);

        if (end >= start) {
          const diff = (end - start) / (1000 * 60 * 60 * 24 * 365.25);
          updated.total_years = diff.toFixed(1);
        } else {
          updated.total_years = "";
        }
      }

      return updated;
    });
  };

  /* ================= EDIT ================= */

  const handleEdit = (exp, index) => {
    if (draft) {
      toast.error("Please save or cancel current changes first");
      return;
    }

    setEditingIndex(index);
    setDraft({
      id: exp.id,
      companyName: exp.company_name,
      companyLocation: exp.location,
      designation: exp.designation,
      start_date: toInputDate(exp.start_date),
      end_date: toInputDate(exp.end_date),
      total_years: exp.total_years,
    });
  };

  /* ================= CANCEL ================= */

  const handleCancel = () => {
    setDraft(null);
    setEditingIndex(null);
    setIsAddingNew(false);
  };

  /* ================= VALIDATION ================= */

  const validateDraft = () => {
    if (!draft.companyName) return "Company name required";
    if (!draft.designation) return "Designation required";
    if (!draft.start_date) return "Start date required";
    return null;
  };

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (!draft) return;

    const error = validateDraft();
    if (error) {
      toast.error(error);
      return;
    }

    if (!empId) {
      toast.error("Employee ID missing");
      return;
    }

    const toastId = toast.loading("Saving experience...");
    setLoading(true);

    try {
      const payload = {
        company_name: draft.companyName,
        location: draft.companyLocation,
        designation: draft.designation,
        start_date: draft.start_date,
        end_date: draft.end_date,
        total_years: draft.total_years,
      };

      if (draft.id) {
        await updateExperience(empId, draft.id, payload);
        toast.success("Experience updated", { id: toastId });
      } else {
        await addExperienceses(empId, payload);
        toast.success("Experience added", { id: toastId });
      }

      setDraft(null);
      setEditingIndex(null);
      setIsAddingNew(false);

      if (onSave) await onSave();
    } catch (err) {
      console.error(err);
      toast.error("Save failed", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    if (!empId) return;
    if (!window.confirm("Delete this record?")) return;

    const toastId = toast.loading("Deleting...");
    setLoading(true);

    try {
      await deleteExperience(empId, id);
      toast.success("Deleted", { id: toastId });

      if (onSave) await onSave();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="container-fluid">
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-200">
              <tr>
                {[
                  "Company",
                  "Location",
                  "Designation",
                  "Start Date",
                  "End Date",
                  "Years",
                  "Actions",
                ].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-sm text-gray-600">
                    <Loader />
                  </td>
                </tr>
              ) : experienceData.length === 0 && editingIndex !== "new" ? (
                <tr>
                  <td
                    colSpan="7"
                    className="text-center py-8 text-sm text-gray-600 italic bg-gray-50"
                  >
                    No experience records found
                  </td>
                </tr>
              ) : (
                experienceData.map((exp, index) =>
                  editingIndex === index ? (
                    <EditableRow
                      key={exp.id || index}
                      draft={draft}
                      onChange={handleChange}
                      onSave={handleSave}
                      onCancel={handleCancel}
                    />
                  ) : (
                    <tr key={exp.id || index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-600">{exp.company_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{exp.location}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{exp.designation}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {formatDate(exp.start_date)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatDate(exp.end_date)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{exp.total_years} yrs</td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-center">
                        <div className="flex justify-center gap-4">
                          <button
                            onClick={() => handleEdit(exp, index)}
                            className="text-blue-600"
                          >
                            <FaPencilAlt />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="text-red-500"
                          >
                            <MdDelete size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )
              )}

              {/* NEW ROW */}
              {editingIndex === "new" && draft && (
                <EditableRow
                  draft={draft}
                  onChange={handleChange}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const EditableRow = ({ draft, onChange, onSave, onCancel }) => (
  <tr className="bg-blue-50">
    {[["companyName"], ["companyLocation"], ["designation"]].map(([field]) => (
      <td key={field} className="p-2 text-sm text-gray-600">
        <input
          value={draft[field] || ""}
          onChange={(e) => onChange(field, e.target.value)}
          className="w-full border px-2 py-1 text-sm rounded"
        />
      </td>
    ))}

    <td className="p-2 text-sm text-gray-600">
      <input
        type="date"
        value={draft.start_date || ""}
        onChange={(e) => onChange("start_date", e.target.value)}
        className="w-full border px-2 py-1 text-sm rounded"
      />
    </td>

    <td className="p-2 text-sm text-gray-600">
      <input
        type="date"
        value={draft.end_date || ""}
        onChange={(e) => onChange("end_date", e.target.value)}
        className="w-full border px-2 py-1 text-sm rounded"
      />
    </td>

    <td className="p-2 text-sm text-gray-600">
      <input
        value={draft.total_years || ""}
        readOnly
        className="w-full border px-2 py-1 text-sm rounded bg-gray-100"
      />
    </td>

    <td className="p-2 text-center text-sm text-gray-600">
      <div className="flex justify-center gap-4">
        <button onClick={onSave} className="text-green-600">
          <FaCheck />
        </button>
        <button onClick={onCancel} className="text-orange-500">
          <FaTimes />
        </button>
      </div>
    </td>
  </tr>
);

export default AddExperienceTab;
