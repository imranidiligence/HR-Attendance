import React, { useContext, useRef, useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { AuthContext } from "../../context/AuthContextProvider";
import api from "../../../api/axiosInstance";
import { FaPencilAlt, FaCheck, FaTimes, FaFileAlt } from "react-icons/fa";
import { FaCloudUploadAlt } from "react-icons/fa";

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

const DocumentTab = ({
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

    // console.log("isEditing",isEditing)
    // console.log("setIsAddingNew",setIsAddingNew)
    // console.log(" setEditingIndex(null);",  setEditingIndex(null))
  },[setIsAddingNew,isEditing])
  /* ================= FETCH DOCUMENTS ================= */

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.get(`/employee/profile/bank/doc/${empId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // console.log("Res Documents", res);
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

        // console.log("formatted", formatted);
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
      // setDraft({ });
      setEditingIndex("new"); // show as normal row first
    }
  }, [documents]);

  useEffect(() => {
    if (isAddingNew) {
      setDraft({ });
      setEditingIndex("new-edit"); // directly editable row
    }
  }, [isAddingNew]);
  /* ================= EDIT EXISTING ================= */

const handleEdit = (doc, index) => {
  // 1. Toggle off if clicking the same row again
  if (editingIndex === index) {
    handleCancel();
    return;
  }

  // 2. Set the editing index to the current row
  setEditingIndex(index);

  // 3. Populate draft with ALL necessary data
  setDraft({
    id: doc.id,
    documentType: doc.document_type,
    documentNumber: doc.document_number || "",
    // 'file' represents a NEW selection (starts as null)
    file: null, 
    // Store existing info for the UI to display "Prev: filename"
    existingFileName: doc.file_name || "",
    existingUrl: doc.fullUrl || "",
  });

  // 4. Ensure "Add New" state is closed if it was open
  setIsAddingNew(false);
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

      // console.log("draft Document", draft);
      if (draft.file) {
        fd.append("file", draft.file);
      }

      // console.log("formData", fd)
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
      setDraft(null);
    } else {
      setDraft(null);
      setEditingIndex(null);
    }

    setIsAddingNew(false);
    setIsEditing(false);
  };

  useEffect(()=>{
    // console.log("fileRef",fileRef.file)

  },[fileRef])

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
        key={doc.id || index}
        draft={draft}
        setDraft={setDraft}
        onSave={handleSave}
        onCancel={handleCancel}
        fileRef={fileRef}
        handleFileChange={handleFileChange}
      />
    ) : (
      <tr key={doc.id || index}>
        <td className="px-4 py-2 text-sm text-gray-600">{doc.document_type}</td>
        <td className="px-4 py-2 text-sm text-gray-600">{doc.document_number || "-"}</td>
        <td className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer">
          <span onClick={() => window.open(doc.fullUrl, "_blank")}>
            {doc.file_name || "View Document"}
          </span>
        </td>
        <td className="px-4 py-2 text-center">
          <div className="flex gap-4 justify-center">
            <button onClick={() => handleEdit(doc, index)} className="text-blue-500">
              <FaPencilAlt />
            </button>
            <button onClick={() => handleDelete(doc.id)} className="text-red-500">
              <MdDelete size={20} />
            </button>
          </div>
        </td>
      </tr>
    )
  )}

  {/* Logic for Adding a Brand New Row */}
  {isAddingNew && (
    editingIndex === "new-edit" ? (
      <EditableRow
        draft={draft}
        setDraft={setDraft}
        onSave={handleSave}
        onCancel={handleCancel}
        fileRef={fileRef}
        handleFileChange={handleFileChange}
      />
    ) : (
      <tr className="bg-blue-50">
        <td className="px-4 py-2 text-sm italic text-gray-500">New Document...</td>
        <td colSpan="2"></td>
        <td className="px-4 py-2 text-center">
          <button onClick={() => setEditingIndex("new-edit")} className="text-blue-500">
            <FaPencilAlt />
          </button>
        </td>
      </tr>
    )
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
  // useEffect(()=>{
  //   console.log("draft document",draft.file?.name);
  // },[draft])
  return (
    <tr className="bg-blue-50/30">
      <td className="p-2 text-sm text-gray-600">
      <select
  className={`w-full border px-2 py-1 text-sm rounded ${
    !draft?.documentType ? "text-gray-400" : "text-black"
  }`}
  value={draft?.documentType || ""}
  onChange={(e) =>
    setDraft((prev) => ({
      ...prev,
      documentType: e.target.value,
    }))
  }
>
  {/* The Placeholder Option */}
  <option value="" disabled>
    Select Document Type
  </option>

  {/* The Actual Data Options */}
  {documentTypes.map((type) => (
    <option key={type} value={type} className="text-black">
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

    <td className="px-4 py-2">
  <div className="flex items-center gap-2">
    {/* Hidden File Input */}
    <input
      type="file"
      ref={fileRef}
      className="hidden"
      onChange={handleFileChange}
    />
    
    {/* Upload Trigger Icon */}
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      className="p-1 hover:bg-gray-100 rounded border"
    >
      <FaCloudUploadAlt className="text-blue-500" size={25} />
    </button>

    {/* Dynamic Filename Display */}
    <div className="text-[10px] truncate max-w-[120px]">
      {draft.file ? (
        // Show new file name in green if they just picked one
        <span className="text-green-600 font-bold">{draft.file.name}</span>
      ) : (
        // Show the name from the DB if they haven't picked a new one yet
        <span className="text-gray-500 italic">
          {draft.existingFileName || "No file uploaded"}
        </span>
      )}
    </div>
  </div>
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

export default DocumentTab;