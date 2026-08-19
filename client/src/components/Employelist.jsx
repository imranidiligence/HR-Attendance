import React, { useContext, useEffect, useState } from "react";
import { EmployContext } from "../context/EmployContextProvider";
import { NavLink } from "react-router-dom";
import Loader from "./Loader";
import api from "../../api/axiosInstance";
import Pagination from "../components/Pagination";

const Employelist = () => {
  const { formatDate } = useContext(EmployContext);

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 15,
  });
  const [loading, setLoading] = useState(true);
  const baseURL = import.meta.env.VITE_API_URL;
  const [totalsStaff, setTotalsStaff] = useState(0);

  const fetchEmployees = async (page = 1) => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const res = await api.get(
        `${baseURL}/admin/attendance/today/all?page=${page}&limit=${pagination.limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      console.log("Fetched Employees:", res.data);

      setEmployees(res.data.employees || []);
      setTotalsStaff(res.data.pagination?.totalItems || 0);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(1);
  }, []);

  const handlePageChange = (_, page) => {
    fetchEmployees(page);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const empHeader = [
    { label: "Emp ID", key: "emp_id" },
    { label: "Emp Name", key: "name" },
    { label: "Email", key: "email" },
    { label: "Department", key: "department" },
    { label: "Joining Date", key: "joining date" },
    { label: "Action", key: "action" },
  ];

  const filteredEmployees = Array.isArray(employees)
    ? employees.filter((emp) => emp.emp_id && emp.emp_id !== "2020")
    : [];
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Employee Management
          </h2>
          <p className="text-sm text-gray-500">
            View and manage all organization personnel
          </p>
        </div>
        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200 shadow-sm">
          Total Staff: {totalsStaff}
        </div>
      </div>

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
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.emp_id}
                  className="hover:bg-blue-50/40 transition-colors duration-150"
                >
                  <td className="px-6 py-4">
                    <span
                      className={`text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded ${emp.is_active ? "text-white bg-green-500" : "text-white bg-red-500"}`}
                    >
                      {emp.emp_id}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {emp.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {emp.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {emp.department ? emp.department : "--"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(emp.joining_date)}
                  </td>

                  <td className="px-6 py-4 flex gap-2">
                    <NavLink
                      to={`/admin/employee/edit/${emp.emp_id}`}
                      className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm"
                    >
                      View Profile
                    </NavLink>
                    {/* <NavLink 
                    to={`/admin/employee-details/edit/${emp.emp_id}`}
                    className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm"
                    >Edit</NavLink> */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.totalPages > 1 && (
            <div className="flex justify-center py-5">
              <Pagination
                totalPages={pagination.totalPages}
                page={pagination.currentPage}
                totalRecords={pagination.totalItems}
                limit={pagination.limit}
                onChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Employelist;
