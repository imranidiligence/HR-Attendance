import React, { useContext, useRef, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { AuthContext } from "../../context/AuthContextProvider";
import api from "../../../api/axiosInstance";
import { FaPencilAlt, FaCheck, FaTimes, FaFileAlt } from "react-icons/fa";
import { MdDelete } from "react-icons/md";

const documentTypes = [
  "Passport Size Photo",
  "Aadhar Card",
  "PAN Card",
  "Bank PassBook",
  "Passport",
  "Updated CV",
  "UAN Card",
];

const emptyDocument = {
  documentType: "Aadhar Card",
  documentNumber: "1234567",
  file: null,
};

const AddDocumentTab = ({
  isEditing,
  setIsEditing,
  setIsAddingNew,
  isAddingNew,
  empId,
}) => {
  const { token } = useContext(AuthContext);

  // console.log("isEditing Document",isEditing);

  

  const [documents, setDocuments] = useState([]);
  const [draft, setDraft] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const fileRef = useRef(null);


  useEffect(()=>{

    console.log("isEditing",isEditing)
    console.log("setIsAddingNew",setIsAddingNew)
    console.log(" setEditingIndex(null);",  setEditingIndex(null))
  },[setIsAddingNew,isEditing])
  /* ================= FETCH DOCUMENTS ================= */

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.get(`/employee/profile/bank/doc/${empId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Res Documents", res);
        const BASE_URL = api.defaults.baseURL.split("/api")[0];

        const formatted =
          res.data.documents?.map((doc) => ({
            ...doc,
            fullUrl: `${BASE_URL}${doc.file_path}`.replace(
              /([^:]\/)\/+/g,
              "$1"
            ),
            fileName: doc.file_path.split("/").pop(),
          })) || [];

        console.log("formatted", formatted);
        setDocuments(formatted);
      } catch (err) {
        console.error(err);
      }
    };

    if (empId) fetchDocs();
  }, [empId, token]);

  /* ================= SHOW DRAFT IF EMPTY ================= */

  useEffect(() => {
    if (documents.length === 0) {
      setDraft({ ...emptyDocument });
      setEditingIndex("new"); // show as normal row first
    }
  }, [documents]);

  useEffect(() => {
    if (isAddingNew) {
      setDraft({ ...emptyDocument });
      setEditingIndex("new-edit"); // directly editable row
    }
  }, [isAddingNew]);
  /* ================= EDIT EXISTING ================= */

  const handleEdit = (doc, index) => {


  if (editingIndex === index) {
    handleCancel();
    return;
  }

  // Switch to new row 
  setEditingIndex(index);

  setDraft({
    documentType: doc.document_type,
    documentNumber: doc.document_number || "",
    file: null,
    id: doc.id,
  });

  
};


  /* ================= FILE CHANGE ================= */

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setDraft((prev) => ({
      ...prev,
      file,
    }));
  };

  /* ================= SAVE ================= */

  const handleSave = async () => {
    if (!draft) return;

    try {
      const fd = new FormData();

      fd.append("documentType", draft.documentType);
      fd.append("documentNumber", draft.documentNumber);

      console.log("draft Document", draft);
      if (draft.file) {
        fd.append("file", draft.file);
      }

      console.log("formData", fd)
      await api.post(`/employee/profile/bank/doc/${empId}`, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Document saved");

      setDraft(null);
      setEditingIndex(null);
      setIsAddingNew(false);
      setIsEditing(false);

      // Refresh list
      const res = await api.get(`/employee/profile/bank/doc/${empId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const BASE_URL = api.defaults.baseURL.split("/api")[0];

      const formatted =
        res.data.documents?.map((doc) => ({
          ...doc,
          fullUrl: `${BASE_URL}${doc.file_path}`.replace(
            /([^:]\/)\/+/g,
            "$1"
          ),
          fileName: doc.file_path.split("/").pop(),
        })) || [];

      setDocuments(formatted);
    } catch (err) {
      toast.error("Save failed");
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document?")) return;

    // console.log("Doc id",id)

    try {
      await api.delete(`/employee/profile/bank/doc/${empId}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= CANCEL ================= */

  const handleCancel = () => {
    if (editingIndex === "new-edit") {
      setEditingIndex("new"); // go back to draft view
    } else {
      setDraft(null);
      setEditingIndex(null);
    }

    setIsAddingNew(false);
    setIsEditing(false);
  };

  /* ================= UI ================= */

  return (
    <div className="container-fluid">
      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-4 py-2 text-sm text-gray-600 mb-1 font-medium text-left">
                  Document type
                </th>
                <th className="px-4 py-2 text-sm text-gray-600 mb-1 font-medium text-left">
                  Document No.
                </th>
                <th className="px-4 py-2 text-sm text-gray-600 mb-1 font-medium text-left">
                  Document
                </th>
                <th className="px-4 py-2 text-sm text-gray-600 mb-1 font-medium text-center">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc, index) =>
                editingIndex === index ? (
                  <EditableRow
                    key={doc.id}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    fileRef={fileRef}
                    handleFileChange={handleFileChange}
                  />
                ) : (
                  <tr key={doc.id}>
                    <td className="px-4 py-2 text-sm text-gray-600">{doc.document_type}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {doc.document_number || "-"}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 underline cursor-pointer">
                      <span onClick={() => window.open(doc.fullUrl, "_blank")}>
                        {doc.file_name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 text-center">
                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={() => handleEdit(doc, index)}
                          className="text-blue-500"
                        >
                          <FaPencilAlt />
                        </button>

                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-red-500"
                        >
                          <MdDelete size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {/* Draft row normal view */}
              {draft && editingIndex === "new" && (
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {draft.documentType}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {draft.documentNumber || "-"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {draft.file ? draft.file : "-"}
                  </td>
                  <td className="px-4 py-2 text-center text-sm text-gray-600">
                    <button
                      onClick={() => setEditingIndex("new-edit")}
                      className="text-blue-500"
                    >
                      <FaPencilAlt />
                    </button>
                  </td>
                </tr>
              )}

              {/* Draft editable */}
              {editingIndex === "new-edit" && draft && (
                <EditableRow
                  draft={draft}
                  setDraft={setDraft}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  fileRef={fileRef}
                  handleFileChange={handleFileChange}
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

const EditableRow = ({
  draft,
  setDraft,
  onSave,
  onCancel,
  fileRef,
  handleFileChange,
}) => {
  return (
    <tr className="bg-blue-50/30">
      <td className="p-2 text-sm text-gray-600">
        <select
          className="w-full border px-2 py-1 text-sm rounded"
          value={draft?.documentType || ""}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              documentType: e.target.value,
            }))
          }
        >
          {documentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </td>

      <td className="p-2 text-sm text-gray-600">
        <input
          className="w-full px-2 py-1.5 text-sm border rounded"
          value={draft.documentNumber}
          placeholder="Document No"
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              documentNumber: e.target.value,
            }))
          }
        />
      </td>

      <td className="p-2 text-left text-sm text-gray-600">
        <input
          type="file"
          ref={fileRef}
          accept=".jpg,.jpeg,.pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {draft.file ? (
          <span className="text-sm text-gray-600 ms-4">
            {draft.file.name}
          </span>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="text-gray-600 ms-4 mt-1"
          >
            <FaFileAlt size={18} />
          </button>
        )}
      </td>

      <td className="p-2 text-center text-sm text-gray-600">
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
};

export default AddDocumentTab;