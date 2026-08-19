// import React, { useContext, useEffect, useState, useCallback } from "react";
// import FormCard from "../../components/FormCard";
// import Input from "../../components/Input";
// import { toast } from "react-hot-toast";
// import { getBank, addBank, updateBank } from "../../../api/profile";
// import { emptyBank } from "../../constants/emptyData";
// import { AuthContext } from "../../context/AuthContextProvider";
// import { useParams } from "react-router-dom";

// const BankTab = ({ isEditing, setIsEditing,empId }) => {
//   // const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;

//   const {emp_id} = useParams();

//   const finalEmpId = emp_id || empId;


//   const { token } = useContext(AuthContext);

//   // Initialize as empty array to avoid ReferenceError
//   const [draft, setDraft] = useState([]);
//   const [errors, setErrors] = useState([]);
//   const [loading, setLoading] = useState(false);

//   // Memoized fetch function to reuse in useEffect and handleSave
//   const fetchBank = useCallback(async () => {
//     if (!finalEmpId) return;
//     setLoading(true);
//     try {
//       const res = await getBank(finalEmpId);
//       const bankData = res?.data?.bankDetails;

//       if (bankData?.length > 0) {
//         const mapped = bankData.map((b) => ({
//           ...emptyBank,
//           ...b,
//         }));

//         // console.log("mapped",mapped);

//         setDraft(mapped);
//       } else {
//         setDraft([{ ...emptyBank }]);
//       }
//     } catch (error) {
//       console.error("Failed to fetch bank details:", error);
//       setDraft([{ ...emptyBank }]);
//     } finally {
//       setLoading(false);
//     }
//   }, [emp_id]);

//   useEffect(() => {
//     if (token) fetchBank();
//   }, [fetchBank, token]);

//   const handleSave = async () => {
//     let hasErrors = false;
//     const newErrors = [];

//     // Validation
//     draft.forEach((bank, index) => {
//       const bankErrors = {};
//       Object.keys(emptyBank).forEach((key) => {
//         // Skip technical fields and optional UPI
//         if (key !== "id" && key !== "is_active" && key !== "upi_id") {
//           if (!bank[key] || bank[key].toString().trim() === "") {
//             bankErrors[key] = "REQUIRED";
//             hasErrors = true;
//           }
//         }
//       });
//       newErrors[index] = bankErrors;
//     });

//     if (hasErrors) {
//       setErrors(newErrors);
//       toast.error("Please fill all required fields");
//       return;
//     }

//     try {
//       for (const bank of draft) {
//         if (bank.id) {
//           await updateBank(emp_id, bank.id, bank);
//         } else {
//           await addBank(emp_id, bank);
//         }
//       }
//       toast.success("Bank details saved successfully");
//       setIsEditing(false);
//       setErrors([]);
//       fetchBank(); // Refresh data to sync IDs
//     } catch (error) {
//       toast.error("Failed to save bank details");
//     }
//   };

//   const handleCancel = () => {
//     fetchBank(); // Revert to database state
//     setErrors([]);
//     setIsEditing(false);
//   };

//   if (loading && draft.length === 0) {
//     return <div className="p-10 text-center text-gray-500">Loading bank details...</div>;
//   }

//   return (
//     <div className="flex flex-col gap-6 w-full">
//       {draft.map((bank, index) => (
//         <FormCard key={bank.id || index}>
//           {/* Strict 3-column Grid Wrapper */}
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
//             {Object.keys(emptyBank).map((key) => {
//               // Hide non-user fields
//               if (key === "id" || key === "is_active") return null;

//               return (
//                 <div key={key} className="flex flex-col w-full">
//                   <Input
//                     label={key.replace(/_/g, " ")}
//                     value={bank[key] || ""}
//                     disabled={!isEditing}
//                     className="w-full capitalized"
//                     onChange={(e) => {
//                       const copy = [...draft];
//                       // Update the specific field in the specific bank object
//                       copy[index] = { ...copy[index], [key]: e.target.value };
//                       setDraft(copy);

//                       // Clear error for this field
//                       if (errors[index]?.[key]) {
//                         const errorCopy = [...errors];
//                         errorCopy[index] = { ...errorCopy[index] };
//                         delete errorCopy[index][key];
//                         setErrors(errorCopy);
//                       }
//                     }}
//                   />
//                   {isEditing && errors[index]?.[key] && (
//                     <p className="text-red-500 text-[10px] font-bold mt-1 italic uppercase">
//                       * {errors[index][key]}
//                     </p>
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         </FormCard>
//       ))}

//       {isEditing && (
//         <div className="flex justify-end gap-3 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
//           <button
//             className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
//             onClick={handleCancel}
//           >
//             Cancel
//           </button>
//           <button
//             className="px-6 py-2 bg-[#222F7D] text-white rounded-lg hover:bg-blue-900 shadow-md transition-all font-medium"
//             onClick={handleSave}
//           >
//             Save Bank Details
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default BankTab;

import React, { useContext, useEffect, useState, useCallback } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import { toast } from "react-hot-toast";
import { getBank, addBank, updateBank } from "../../../api/profile";
import { emptyBank } from "../../constants/emptyData";
import { AuthContext } from "../../context/AuthContextProvider";
import { useParams } from "react-router-dom";

const BankTab = ({ isEditing, setIsEditing,empId }) => {
  // const emp_id = JSON.parse(localStorage.getItem("user"))?.emp_id;

  const {emp_id} = useParams();

  const finalEmpId = emp_id || empId;
const token = localStorage.getItem("token");

// console.log("empId props",empId);
// console.log("finalEmpId",finalEmpId);

  // const { token } = useContext(AuthContext);

  // console.log("token",token);
  // Initialize as empty array to avoid ReferenceError
  const [draft, setDraft] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Memoized fetch function to reuse in useEffect and handleSave
  const fetchBank = useCallback(async () => {
    if (!finalEmpId) return;
    setLoading(true);
    try {
      const res = await getBank(finalEmpId);
      const bankData = res?.data?.bankDetails;

      // console.log("bankData",bankData);
      if (bankData?.length > 0) {
        const mapped = bankData.map((b) => ({
          ...emptyBank,
          ...b,
        }));

        // console.log("mapped",mapped);

        setDraft(mapped);
      } else {
        setDraft([{ ...emptyBank }]);
      }
    } catch (error) {
      console.error("Failed to fetch bank details:", error);
      setDraft([{ ...emptyBank }]);
    } finally {
      setLoading(false);
    }
  }, [emp_id]);

  useEffect(() => {
    if (token) fetchBank();
  }, [fetchBank, token]);

const handleSave = async () => {
  let hasErrors = false;
  const newErrors = [];

  draft.forEach((bank, index) => {
    const bankErrors = {};

    Object.keys(emptyBank).forEach((key) => {
      if (key !== "id" && key !== "is_active" && key !== "upi_id") {
        const value = bank[key];

        if (!value || value.toString().trim() === "") {
          //  Better error message
          bankErrors[key] = `${key.replace(/_/g, " ")} is required`;
          hasErrors = true;
        }

        // Extra validations (ERP level)
        if (key === "account_number" && value) {
          if (!/^\d+$/.test(value)) {
            bankErrors[key] = "Account number must be numeric";
            hasErrors = true;
          }
        }

        // if (key === "ifsc_code" && value) {
        //   if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)) {
        //     bankErrors[key] = "Invalid IFSC code";
        //     hasErrors = true;
        //   }
        // }
      }
    });

    newErrors[index] = bankErrors;
  });

  if (hasErrors) {
    setErrors(newErrors);
    toast.error("Please fix errors before saving");

    //  Scroll to first error (pro UX)
    setTimeout(() => {
      const el = document.querySelector(".error-field");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);

    return;
  }

  try {
    for (const bank of draft) {
      if (bank.id) {
        await updateBank(finalEmpId, bank);
      } else {
        await addBank(finalEmpId, bank);
      }
    }

    toast.success("Bank details saved successfully");
    setIsEditing(false);
    setErrors([]);
    fetchBank();
  } catch (error) {
    toast.error("Failed to save bank details");
  }
};

  const handleCancel = () => {
    fetchBank(); // Revert to database state
    setErrors([]);
    setIsEditing(false);
  };

  if (loading && draft.length === 0) {
    return <div className="p-10 text-center text-gray-500">Loading bank details...</div>;
  }

  // console.log("Bank draft",draft)
  return (
    <div className="flex flex-col gap-6 w-full">
      {draft.map((bank, index) => (
        <FormCard key={bank.id || index}>
          {/* Strict 3-column Grid Wrapper */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {Object.keys(emptyBank).map((key) => {
              // Hide non-user fields
              if (key === "id" || key === "is_active") return null;

              // console.log("bank key",bank[key]);
              return (
                <div key={key} className="flex flex-col w-full">
                  <Input
                    label={key.replace(/_/g, " ")}
                    value={bank[key] || ""}
                    disabled={!isEditing}
                    className="w-full capitalized"
                    onChange={(e) => {
                      const copy = [...draft];
                      // Update the specific field in the specific bank object
                      copy[index] = { ...copy[index], [key]: e.target.value };
                      setDraft(copy);

                      // Clear error for this field
                      if (errors[index]?.[key]) {
                        const errorCopy = [...errors];
                        errorCopy[index] = { ...errorCopy[index] };
                        delete errorCopy[index][key];
                        setErrors(errorCopy);
                      }
                    }}
                  />
                  {isEditing && errors[index]?.[key] && (
                    <p className="text-red-500 text-[10px] font-bold mt-1 italic uppercase">
                      * {errors[index][key]} 
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </FormCard>
      ))}

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

export default BankTab;