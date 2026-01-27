import React, { useContext } from 'react';
import { EmployContext } from '../context/EmployContextProvider';
import { NavLink } from 'react-router-dom';

const Employelist = () => {
  const { adminAttendance, loading } = useContext(EmployContext);

  const empHeader = [
    { label: "Emp ID", key: "emp_id" },
    { label: "Emp Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Status", key: "status" },
    { label: "Action", key: "action" }
  ];

  // Filtering out specific admin/test ID
  const filteredEmployees = adminAttendance.filter(
    emp => emp.emp_id !== "202500021"
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 bg-gray-50 min-h-screen">
      {/* ERP Page Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Employee Management</h2>
          <p className="text-sm text-gray-500">View and manage all organization personnel</p>
        </div>
        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200 shadow-sm">
          Total Staff: {filteredEmployees.length}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {empHeader.map((header, index) => (
                  <th
                    key={index}
                    className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                  >
                    <div className="flex items-center gap-2">
                      {header.label}
                      {header.label !== "Action" && (
                        <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 320 512">
                          <path d="M41 288h238c21.4 0 32.1 25.9 17 41L177 448c-9.4 9.4-24.6 9.4-33.9 0L24 329c-15.1-15.1-4.4-41 17-41zm255-105L177 64c-9.4-9.4-24.6-9.4-33.9 0L24 183c-15.1 15.1-4.4 41 17 41h238c21.4 0 32.1-25.9 17-41z" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 italic">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-2">📁</span>
                      No employee records found
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.emp_id}
                    className="hover:bg-blue-50/40 transition-colors duration-150"
                  >
                    {/* ID Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {emp.emp_id}
                      </span>
                    </td>

                    {/* Name Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{emp.name}</div>
                    </td>

                    {/* Email Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{emp.email}</div>
                    </td>

                    {/* Status Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          emp.is_active
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-red-100 text-red-700 border border-red-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${emp.is_active ? "bg-green-600" : "bg-red-600"}`}></span>
                        {emp.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <NavLink
                        to={`/admin/employee-details/${emp.emp_id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm"
                      >
                        View Profile
                      </NavLink>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Employelist;