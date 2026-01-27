import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import axios from "axios";

const ReportingAdmin = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedManagers, setSelectedManagers] = useState([]);

  const handleManagerChange = (e, index) => {
    const value = e.target.value;
    const updated = [...selectedManagers];
    updated[index] = { ...updated[index], emp_code: value };
    setSelectedManagers(updated);
  };

  const handleReportTypeChange = (e, index) => {
    const value = e.target.value;
    const updated = [...selectedManagers];
    updated[index] = { ...updated[index], report_type: value };
    setSelectedManagers(updated);
  };

  const addManagerRow = () => {
    setSelectedManagers([...selectedManagers, { emp_code: "", report_type: "secondary" }]);
  };

  const removeManagerRow = (index) => {
    const updated = selectedManagers.filter((_, i) => i !== index);
    setSelectedManagers(updated);
  };

  // Fetch all employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const resp = await axios.get("http://localhost:5000/api/employee/attendance/all-emp");
        setEmployees(resp.data); // use resp.data, not resp
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch employees");
      }
    };
    fetchEmployees();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || selectedManagers.length === 0) {
      toast.error("Select employee and at least one manager");
      return;
    }

    try {
      await axios.post("http://localhost:5000/api/employees/reporting", {
        emp_code: selectedEmployee,
        managers: selectedManagers,
      });
      toast.success("Reporting structure updated!");
      setSelectedManagers([]);
      setSelectedEmployee("");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update reporting");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 text-center">Assign Reporting Managers</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select Employee */}
        <div>
          <label className="block mb-1 font-medium">Employee</label>
          <select
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="">Select Employee</option>
            {employees.map((emp) => (
              <option key={emp.emp_id} value={emp.emp_id}>
                {emp.name} ({emp.emp_id})
              </option>
            ))}
          </select>
        </div>

        {/* Managers */}
        <div>
          <label className="block mb-1 font-medium">Managers</label>
          {selectedManagers.map((mgr, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <select
                className="flex-1 border border-gray-300 rounded px-3 py-2"
                value={mgr.emp_code}
                onChange={(e) => handleManagerChange(e, index)}
              >
                <option value="">Select Manager</option>
                {employees
                  .filter((emp) => emp.emp_id !== selectedEmployee) // prevent self-report
                  .map((emp) => (
                    <option key={emp.emp_id} value={emp.emp_id}>
                      {emp.name} ({emp.emp_id})
                    </option>
                  ))}
              </select>

              <select
                className="border border-gray-300 rounded px-2 py-1"
                value={mgr.report_type}
                onChange={(e) => handleReportTypeChange(e, index)}
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="dotted">Dotted</option>
              </select>

              <button
                type="button"
                className="text-red-500 font-bold"
                onClick={() => removeManagerRow(index)}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            className="mt-2 text-blue-600 font-medium"
            onClick={addManagerRow}
          >
            + Add Manager
          </button>
        </div>

        {/* Submit */}
        <div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save Reporting
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportingAdmin;
