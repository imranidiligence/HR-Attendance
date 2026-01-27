import React, { useContext, useEffect, useState } from "react";
import FormCard from "../../components/FormCard";
import Input from "../../components/Input";
import { getOrganization } from "../../../api/profile";
import { EmployContext } from "../../context/EmployContextProvider";
import { AuthContext } from "../../context/AuthContextProvider";

const OrganizationTab = () => {
  const [org, setOrg] = useState({});
  const { setOrgAddress } = useContext(EmployContext);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    // Get the user inside the effect to ensure we have the latest from storage
    const user = localStorage.getItem("user");
    const storedUser = user ? JSON.parse(user) : null;
    const currentEmpId = storedUser?.emp_id;

    if (currentEmpId && token) {
      getOrganization()
        .then((res) => {
          const orgDetails = res?.data?.organizationDetails || {};
          setOrg(orgDetails);
          setOrgAddress(orgDetails);
        })
        .catch((err) => console.error("Fetch error:", err));
    }
    // We depend on token. Once the user logs in and token is set, this fires.
  }, [token, setOrgAddress]); 

  const hiddenFields = ["is_active", "created_at"];

  // Logic to handle "Showing nothing" while loading
  const displayFields = Object.keys(org).filter((key) => !hiddenFields.includes(key));

  return (
    <FormCard>
      {displayFields.length > 0 ? (
        displayFields.map((key) => (
          <Input key={key} label={key.replace("_", " ")} value={org[key] || ""} disabled />
        ))
      ) : (
        <p>Loading organization data...</p> // This prevents the "nothing" look
      )}
    </FormCard>
  );
};
export default OrganizationTab;
