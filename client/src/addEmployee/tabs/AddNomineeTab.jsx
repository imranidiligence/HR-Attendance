/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from "react";
import { emptyNominee } from "../../constants/emptyData";
import { addNominee, getNominee, updateNominee } from "../../../api/profile";
import { useParams } from "react-router-dom";
import { toast } from "react-hot-toast";


export const AddNomineeTab = ({ nomineData, isEditing, empId, setIsEditing }) => {
  const [nomineeData, setNomineeData] = useState(emptyNominee);
  const { emp_id } = useParams()

  const finalEmpId = emp_id || empId;


  useEffect(() => {
    if (nomineData && Object.keys(nomineData).length > 0) {
      setNomineeData(nomineData);
    } else {
      setNomineeData(emptyNominee);
    }
  }, [nomineData]);

  // useEffect(()=>{
  //   console.log("url id ", emp_id)
  // },[emp_id])

useEffect(() => {
  if (!finalEmpId) return;

  const fetchNominee = async () => {
    try {
      const resp = await getNominee(finalEmpId);

      setNomineeData(
        resp?.data?.nominee || emptyNominee
      );
    } catch (error) {
      console.log(error);
      setNomineeData(emptyNominee);
    }
  };

  fetchNominee();
}, [finalEmpId]);

  // console.log("nomineeData",nomineeData)



  const handleChange = (field, value) => {
    setNomineeData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // const handleAddRow = async() => {

  //   setNomineData([
  //     ...nomineeData,
  //     {
  //       nomineeName: "",
  //       nomineeRelation: "",
  //       nomineeContact: "",
  //     },
  //   ]);
  // };

  const handleCancel = () => {
    setIsEditing(false);
    // setNomineeData(emptyNominee);
  };

  const handleSave = async () => {
    try {
      if (!finalEmpId) return;

      const resp = nomineeData.id
        ? await updateNominee(finalEmpId, nomineeData.id, nomineeData)
        : await addNominee(finalEmpId, nomineeData);

      console.log("reps save", resp.data.data);
      setNomineeData(prev => ({
        ...prev,
        ...resp.data.data
      }));

      setIsEditing(false);

      toast.success("Nominee Updated Sucessfully")


    } catch (error) {
      console.error(error);
    }
  };
  // useEffect(()=>{

  //   console.log("nomineeData",nomineData);
  // },[nomineData])

  return (
    <div className="bg-white shadow p-4 rounded-lg">
      <form>
        <div className="border rounded p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {/* {nomineData?.map((nominee,index)=>( */}
            <>
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1 font-medium">
                  Nominee Name
                </label>
                <input
                  type="text"
                  value={nomineeData?.nominee_name || ""}
                  onChange={(e) =>
                    handleChange("nominee_name", e.target.value)
                  }
                  disabled={!isEditing}
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1 font-medium">
                  Nominee Relation
                </label>
                <input
                  type="text"
                  value={nomineeData?.nominee_relation || ""}
                  onChange={(e) =>
                    handleChange("nominee_relation", e.target.value)
                  }
                  disabled={!isEditing}
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1 font-medium">
                  Nominee Contact
                </label>
                <input
                  type="text"
                  value={nomineeData?.nominee_contact || ""}
                  onChange={(e) =>
                    handleChange("nominee_contact", e.target.value)
                  }
                  disabled={!isEditing}
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>
            </>
            {/* ))} */}


          </div>
        </div>


        {isEditing && (
          <>
            {/* <div className="flex justify-start mb-4">
              <button
                type="button"
                onClick={handleAddRow}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm"
              >
                + Add Nominee
              </button>
            </div> */}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 rounded-lg text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2 bg-[#222F7D] text-white rounded-lg text-sm"
              >
                Save Changes
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default AddNomineeTab;
