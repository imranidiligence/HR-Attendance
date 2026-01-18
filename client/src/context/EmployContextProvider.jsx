import React, { createContext, useEffect, useState, useMemo } from "react";
import axios from "axios";

export const EmployContext = createContext();

const EmployProvider = ({ children }) => {

  /* Attendance  */
  const [employee, setEmployee] = useState(null);
  const [employeeAttendance, setEmployeeAttendance] = useState([]);
  const [singleAttendance, setSingleAttendance] = useState(null);
  const [adminAttendance, setAdminAttendance] = useState([]);

  /*Loading State*/
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  //  Holidays

  const [holidays,setHolidays] = useState([]);
  /*  Filter State*/
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* 
    auth state
  */
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    return {
      token,
      role: user?.role?.toLowerCase() || null,
    };
  });

  /*Sync login */
  useEffect(() => {
    const syncAuth = () => {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      setAuth({
        token,
        role: user?.role?.toLowerCase() || null,
      });
    };

    syncAuth();
    window.addEventListener("storage", syncAuth);

    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  /*
     AXIOS CONFIG
*/
  const axiosConfig = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    }),
    [auth.token]
  );

//  Employee dashboard
const fetchEmployeeDashboard = async () => {
  try {
    setEmployeeLoading(true);

    const [historyRes, todayRes] = await Promise.all([
      axios.get(
        "http://localhost:5000/api/employee/attendance/history",
        axiosConfig
      ),
      axios.get(
        "http://localhost:5000/api/employee/attendance/today",
        axiosConfig
      ),
    ]);

    // NEW: historyRes.data now has { total_documents, attendance }
    if (historyRes.data && Array.isArray(historyRes.data.attendance)) {
      setEmployeeAttendance(historyRes.data.attendance);

      console.log("Total documents:", historyRes.data.total_documents);
      console.log("Attendance data:", historyRes.data.attendance);

      if (historyRes.data.attendance.length > 0) {
        const emp = historyRes.data.attendance[0];
        setEmployee({
          emp_id: emp.emp_id,
          device_user_id: emp.device_user_id, // optional, only if available
          name: emp.employee_name,            // use employee_name from backend
        });
      }
    } else {
      setEmployeeAttendance([]);
    }

    setSingleAttendance(todayRes.data || null);
  } catch (err) {
    console.error(err);
    setEmployeeAttendance([]);
    setSingleAttendance(null);
  } finally {
    setEmployeeLoading(false);
    setInitialized(true);
  }
};


  // Employees Holidays


  const fetchHolidays = async () => {
    try {
      const resp = await axios.get(
        "http://localhost:5000/api/employee/attendance/holiday",
        axiosConfig
      );
      setHolidays(resp.data);
    } catch (err) {
      console.error(err);
      setHolidays([]);
    }
  };
  
  // Admin Dashboard
  const fetchAdminAttendance = async () => {
    try {
      setAdminLoading(true);

      const res = await axios.get(
        "http://localhost:5000/api/admin/attendance/today",
        axiosConfig
      );

      setAdminAttendance(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setAdminAttendance([]);
    } finally {
      setAdminLoading(false);
      setInitialized(true);
    }
  };

  // Fetch On Auth
  useEffect(() => {
    if (!auth.token || !auth.role) return;
  
    setInitialized(false);
  
    if (auth.role === "admin") {
      fetchAdminAttendance();
    }
  
    if (auth.role === "employee") {
      Promise.all([
        fetchEmployeeDashboard(),
        fetchHolidays(),
      ]);
    }
  
  }, [auth.token, auth.role]);
  

  const loading =
    auth.role === "admin" ? adminLoading : employeeLoading;

  return (
    <EmployContext.Provider
      value={{
        employee,
        employeeAttendance,
        singleAttendance,
        adminAttendance,
        holidays,
        loading,
        initialized,

        /* Filters */
        filters,
        setFilters
        ,
        handleFilterChange,
        

        /* Refresh */
        refreshEmployeeDashboard: fetchEmployeeDashboard,
        refreshAdminAttendance: fetchAdminAttendance,
        
      }}
    >
      {children}
    </EmployContext.Provider>
  );
};

export default EmployProvider;
