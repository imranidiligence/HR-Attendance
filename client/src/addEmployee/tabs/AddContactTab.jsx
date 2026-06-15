import React, { useEffect, useState } from "react";
import { addContact, updateContact, deleteContact } from "../../../api/profile";
import { emptyContact } from "../../constants/emptyData";
import { FaPencilAlt, FaCheck, FaTimes } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { toast } from "react-hot-toast";

const contactTypeOptions = ["Personal", "Emergency", "Work"];

const AddContactTab = ({
  contactData,
  onSave,
  empId,
  isAddingNew,
  setIsAddingNew,
}) => {
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);

  // console.log("contactData",contactData);

  /* ================= HANDLE CHANGE ================= */

  const handleChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  /* ================= EDIT ================= */

  const handleEdit = (contact, index) => {
    if (draft) {
      toast.error("Please save or cancel current changes first");
      return;
    }

    setEditingIndex(index);
    setDraft({ ...contact });
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

    const payload = {
      contact_type: draft.contact_type,
      phone: draft.phone,
      email: draft.email,
      relation: draft.relation,
      is_primary: draft.is_primary ?? false,
    };

    try {
      if (draft.id) {
        const updatedList = contactData.map((c) =>
          c.id === draft.id ? { ...c, ...payload } : c,
        );
        await updateContact(empId, updatedList);
        toast.success("Contact updated");
      } else {
        await addContact(empId, [payload]);
        toast.success("New contact added");
      }

      setDraft(null);
      setEditingIndex(null);
      setIsAddingNew(false);

      if (onSave) await onSave();
    } catch (err) {
      toast.error("Save failed");
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;

    try {
      await deleteContact(empId, id);
      toast.success("Deleted");

      if (onSave) await onSave();
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  /* ================= HANDLE NEW ROW ================= */

  useEffect(() => {
    if (isAddingNew) {
      setDraft({ ...emptyContact });
    }
  }, [isAddingNew]);

  /* ================= DATA SOURCE ================= */

  const rows =
    contactData && contactData.length > 0 ? contactData : [emptyContact];

  /* ================= UI ================= */

  return (
    <div className="container-fluid">
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium">
                  Phone
                </th>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-sm text-gray-600 mb-1 font-medium">
                  Relation
                </th>
                <th className="px-4 py-2 text-center text-sm text-gray-600 mb-1 font-medium">
                  Primary
                </th>
                <th className="px-4 py-2 text-center text-sm text-gray-600 mb-1 font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((contact, index) =>
                editingIndex === index ? (
                  <EditableRow
                    key={contact.id || "new"}
                    draft={draft}
                    onChange={handleChange}
                    onSave={handleSave}
                    onCancel={handleCancel}
                  />
                ) : (
                  <tr key={contact.id || index}>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {contact.contact_type}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{contact.phone}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{contact.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{contact.relation}</td>
                    <td className="px-4 py-2 text-center text-sm text-gray-600">
                      {contact.is_primary ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-2 text-sm text-center text-gray-600">
                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={() => handleEdit(contact, index)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          {draft && draft.id === contact.id ? (
                            <FaCheck />
                          ) : (
                            <FaPencilAlt />
                          )}
                        </button>

                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <MdDelete size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}

              {isAddingNew && draft && !draft.id && (
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

/* ================= EDITABLE ROW ================= */

const EditableRow = ({ draft, onChange, onSave, onCancel }) => {
  if (!draft) return null;

  return (
    <tr className="bg-blue-50/30">
      <td className="p-2 text-sm text-gray-600">
        <select
          className="w-full border px-2 py-1 text-sm rounded"
          value={draft.contact_type || ""}
          onChange={(e) => onChange("contact_type", e.target.value)}
        >
          {contactTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </td>

      <td className="p-2 text-sm text-gray-600">
        <input
          className="w-full border px-2 py-1 text-sm rounded"
          value={draft.phone || ""}
          onChange={(e) => onChange("phone", e.target.value)}
        />
      </td>

      <td className="p-2 text-sm text-gray-600">
        <input
          className="w-full border px-2 py-1 text-sm rounded"
          value={draft.email || ""}
          onChange={(e) => onChange("email", e.target.value)}
        />
      </td>

      <td className="p-2 text-sm text-gray-600">
        <input
          className="w-full border px-2 py-1 text-sm rounded"
          value={draft.relation || ""}
          onChange={(e) => onChange("relation", e.target.value)}
        />
      </td>

      <td className="p-2 text-center text-sm text-gray-600">
        <input
          type="checkbox"
          checked={draft.is_primary || false}
          onChange={(e) => onChange("is_primary", e.target.checked)}
        />
      </td>

      <td className="p-2 text-sm text-gray-600">
        <div className="flex gap-4 items-center justify-center">
          <button
            onClick={onSave}
            className="text-green-600 hover:text-green-800"
          >
            <FaCheck size={16} />
          </button>
          <button
            onClick={onCancel}
            className="text-orange-500 hover:text-orange-700"
          >
            <FaTimes size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default AddContactTab;
