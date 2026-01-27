import React, { useContext, useRef, useState } from "react";
import axios from "axios";
import FormCard from "../../components/FormCard";
import { toast } from "react-hot-toast";
import { AuthContext } from "../../context/AuthContextProvider";

const DOCUMENTS = [
  { key: "aadhaar", label: "Aadhaar Document" },
  { key: "pan", label: "PAN Document" },
  { key: "passbook", label: "Bank Passbook" },
  { key: "address_proof", label: "Address Proof" },
];

const DocumentTab = ({ isEditing, setIsEditing }) => {
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const {token} = useContext(AuthContext)
  // refs for inputs (optional, can be used for reset)
  const refs = {
    aadhaar: useRef(null),
    pan: useRef(null),
    passbook: useRef(null),
    address_proof: useRef(null),
  };

  const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;

  // handle file change
  const handleFileChange = (e, key) => {
    const file = e.target.files[0];
    if (!file) return;

    setFiles((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  // save documents
  const handleSaveDocuments = async () => {
    try {
      const fd = new FormData();
      Object.entries(files).forEach(([key, file]) => {
        if (file) fd.append(key, file);
      });

      if ([...fd.keys()].length === 0) {
        toast.error("Please upload at least one document");
        return;
      }

      await axios.post(
        `http://localhost:5000/api/employee/profile/bank/doc/${emp_id}`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("Documents uploaded successfully");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload documents");
    }
  };

  const renderPreview = (preview, label) =>
    preview ? (
      <div className="w-32 h-32 border rounded flex items-center justify-center overflow-hidden">
        {preview.includes("pdf") ? (
          <a
            href={preview}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 text-sm"
          >
            View {label}
          </a>
        ) : (
          <img
            src={preview}
            alt={label}
            className="w-full h-full object-cover"
          />
        )}
      </div>
    ) : null;

  // optional: reset all files & previews
  const handleCancel = () => {
    setFiles({});
    setPreviews({});
    setIsEditing(false);
    Object.values(refs).forEach((r) => {
      if (r.current) r.current.value = null;
    });
  };

  return (
    <>
      <FormCard title="Documents">
        {DOCUMENTS.map((doc) => (
          <div key={doc.key} className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <label className="block mb-1 text-sm">{doc.label}</label>
              <input
                type="file"
                name={doc.key} // important for Multer
                ref={refs[doc.key]}
                disabled={!isEditing}
                accept="image/*,.pdf"
                onChange={(e) => handleFileChange(e, doc.key)}
              />
            </div>
            {renderPreview(previews[doc.key], doc.label)}
          </div>
        ))}
      </FormCard>

      {isEditing && (
        <div className="flex gap-3 mt-4">
          <button
            className="px-4 py-2 bg-gray-200 rounded"
            onClick={handleCancel}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={handleSaveDocuments}
          >
            Save
          </button>
        </div>
      )}
    </>
  );
};

export default DocumentTab;
