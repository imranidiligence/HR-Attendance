// EmployContext.jsx - Fixed version

import React, {
  createContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import api from "../../api/axiosInstance";

// eslint-disable-next-line react-refresh/only-export-components
export const EmployContext = createContext();

const EmployProvider = ({ children }) => {
  /* Attendance & Data State */
  const [employee, setEmployee] = useState(null);
  const [employeeAttendance, setEmployeeAttendance] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 15,
  });
  const [singleAttendance, setSingleAttendance] = useState(null);
  const [activelogs, setActiveLogs] = useState([]);
  const [singleAdminAttendance, setSingleAdminAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [orgAddress, setOrgAddress] = useState("");

  // Admin Attendance State
  const [adminAttendance, setAdminAttendance] = useState([]);
  const [adminPagination, setAdminPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 100,
  });
  const [showInactive, setShowInactive] = useState(false);

  /* Loading & Initialization */
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [personalAddress, setPersonalAddress] = useState(null);

  // Weekly Attendance Pagination
  const [page, setPage] = useState(1);
  const [weeklyLimit, setWeeklyLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  /* Weekly Data & Filters */
  const [weeklyData, setWeeklyData] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    startDate: "",
    endDate: "",
    employeeSearch: "",
    attendanceSearch: "",
    adminStart: "",
    adminEnd: "",
    adminAttSearch: "",
    actStart: "",
    actEnd: "",
    activitySearch: "",
    weekSearch: "",
    weekTime: "",
    punchIn: "",
    punchOut: "",
  });

  // Dashboard Switch State
  const [isMyDash, setIsMyDash] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  /* Auth State */
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      token,
      role: user?.role?.toLowerCase() || null,
      emp_id: user?.emp_id || null,
    };
  });

  const axiosConfig = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${auth.token}` },
    }),
    [auth.token],
  );

  /* --- ACTIONS --- */
  const handleFilterChange = useCallback((e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleDashboard = useCallback(() => {
    setIsMyDash(true);
  }, []);

  // ============================================
  // 1. EMPLOYEE ATTENDANCE - 15 per page
  // ============================================
  const fetchEmployeeDashboard = useCallback(
    async (page = 1, limit = 15) => {
      if (!auth.token) return;
      try {
        setEmployeeLoading(true);
        const { startDate, endDate } = filters;
        let url = `employee/attendance/history?page=${page}&limit=${limit}`;

        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;

        const [historyRes, todayRes] = await Promise.all([
          api.get(url, axiosConfig),
          api.get("employee/attendance/today", axiosConfig),
        ]);

        if (historyRes.data?.attendance) {
          setEmployeeAttendance(historyRes.data.attendance);
          if (historyRes.data.pagination)
            setPagination(historyRes.data.pagination);
        }
        setSingleAttendance(todayRes.data || null);
      } catch (err) {
        console.error("Dashboard error", err);
      } finally {
        setEmployeeLoading(false);
        setInitialized(true);
      }
    },
    [auth.token, filters.startDate, filters.endDate, axiosConfig],
  );

  // ============================================
  // 2. ADMIN DAILY ATTENDANCE - 100 per page (for charts/cards)
  // ============================================
  const fetchAdminAttendance = useCallback(
    async (page = 1, limit = 100) => {
      if (!auth.token || auth.role !== "admin") return;
      try {
        setAdminLoading(true);
        const res = await api.get(
          `admin/attendance/today?page=${page}&limit=${limit}&showInactive=${showInactive}`,
          axiosConfig,
        );

        setAdminAttendance(
          Array.isArray(res?.data?.employees) ? res.data.employees : [],
        );

        if (res.data?.pagination) {
          setAdminPagination({
            currentPage: res.data.pagination.currentPage,
            totalPages: res.data.pagination.totalPages,
            totalItems: res.data.pagination.totalItems,
            limit: res.data.pagination.limit,
          });
        }
      } catch (err) {
        console.error("Admin fetch failed", err);
      } finally {
        setAdminLoading(false);
      }
    },
    [auth.token, auth.role, showInactive, axiosConfig], // ✅ Added all dependencies
  );

  // ============================================
  // 3. WEEKLY ATTENDANCE
  // ============================================
  const fetchLogs = useCallback(
    async (page = 1, limit = 10) => {
      const currentSearch = (
        filters.activitySearch ||
        filters.search ||
        filters.weekSearch ||
        filters.punchIn ||
        filters.punchOut
      )
        .toString()
        .trim();

      if (!auth.token) return;

      try {
        setWeeklyLoading(true);

        const params = new URLSearchParams();

        if (currentSearch) params.append("search", currentSearch);
        if (filters.startDate) params.append("from", filters.startDate);
        if (filters.endDate) params.append("to", filters.endDate);

        params.append("page", page);
        params.append("limit", limit);

        const queryString = params.toString();
        const url = `admin/attendance/weekly-attendance${
          queryString ? `?${queryString}` : ""
        }`;

        const res = await api.get(url, axiosConfig);

        setWeeklyData(res.data);
        setTotalPages(res.data.totalPages || 1);
        setWeeklyLimit(limit);
      } catch (err) {
        console.error("Fetch error:", err);
        setWeeklyData({ data: [] });
      } finally {
        setWeeklyLoading(false);
      }
    },
    [
      filters.search,
      filters.activitySearch,
      filters.weekSearch,
      filters.startDate,
      filters.endDate,
      auth.token,
      axiosConfig,
    ],
  );

  // ============================================
  // 4. WRAPPER FUNCTIONS - STABLE REFERENCES
  // ============================================

  // Employee view - 15 per page
  const refreshEmployeeDashboard = useCallback(
    (page = 1) => {
      return fetchEmployeeDashboard(page, 15);
    },
    [fetchEmployeeDashboard],
  );

  // Admin daily attendance - 100 per page (for charts/cards)
  const refreshAdminAttendance = useCallback(
    (page = 1) => {
      return fetchAdminAttendance(page, 100);
    },
    [fetchAdminAttendance],
  );

  // Admin my-dashboard (employee history) - 15 per page
  const refreshAdminMyDashboard = useCallback(
    (page = 1) => {
      return fetchEmployeeDashboard(page, 15);
    },
    [fetchEmployeeDashboard],
  );

  // Weekly attendance - 100 per page
  const refreshWeeklyWith100 = useCallback(
    (page = 1) => {
      return fetchLogs(page, 100);
    },
    [fetchLogs],
  );

  // Weekly attendance - 10 per page (default)
  const refreshWeeklyAttendane = useCallback(
    (page = 1) => {
      return fetchLogs(page, 10);
    },
    [fetchLogs],
  );

  // Handler for admin page change
  const handleAdminPageChange = useCallback(
    (page) => {
      fetchAdminAttendance(page, 100);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [fetchAdminAttendance],
  );

  // ============================================
  // 5. HOLIDAYS
  // ============================================
  const fetchHolidays = useCallback(async () => {
    try {
      const res = await api.get("employee/attendance/holiday", axiosConfig);
      setHolidays(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Admin fetch failed", err);
    } finally {
      setAdminLoading(false);
    }
  }, [axiosConfig]);

  // ============================================
  // 6. EFFECTS - ✅ FIXED
  // ============================================

  // Debounced weekly logs fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLogs(page, weeklyLimit);
    }, 400);

    return () => clearTimeout(handler);
  }, [
    page,
    weeklyLimit,
    filters.search,
    filters.activitySearch,
    filters.weekSearch,
    filters.startDate,
    filters.endDate,
    fetchLogs, // ✅ Added fetchLogs
  ]);

  // ✅ FIXED: Initial data fetch with proper dependencies
  useEffect(() => {
    if (!auth.token) return;

    fetchHolidays();

    if (auth.role === "admin") {
      refreshAdminAttendance(1);
    } else {
      refreshEmployeeDashboard(1);
    }
  }, [
    auth.token, 
    auth.role, 
    fetchHolidays, 
    refreshAdminAttendance, 
    refreshEmployeeDashboard
  ]); // ✅ Added all function dependencies

  // Auth sync across tabs
  useEffect(() => {
    const syncAuth = () => {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      setAuth({
        token,
        role: user?.role?.toLowerCase() || null,
        emp_id: user?.emp_id || null,
      });
    };

    syncAuth();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  // ============================================
  // 7. UTILITY FUNCTIONS
  // ============================================
  const formatDate = useCallback((value) => {
    if (!value) return "--";
    const date = new Date(value);
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  }, []);

  // Compute loading state
  const loading = auth.role === "admin" ? adminLoading : employeeLoading;

  // ============================================
  // 8. PROVIDER VALUE - Memoized to prevent re-renders
  // ============================================
  const contextValue = useMemo(
    () => ({
      // Data
      employee,
      employeeAttendance,
      singleAttendance,
      adminAttendance,
      personalAddress,
      setPersonalAddress,
      setAdminAttendance,
      orgAddress,
      setOrgAddress,
      holidays,
      loading,
      initialized,
      profileImage,
      setProfileImage,
      isMyDash,
      setIsMyDash,
      activelogs,
      setActiveLogs,
      singleAdminAttendance,
      setSingleAdminAttendance,
      weeklyLoading,
      weeklyData,
      setWeeklyData,
      adminPagination,
      pagination,
      setPagination,
      filters,
      setFilters,
      showInactive,
      setShowInactive,

      // Auth
      auth,

      // Functions - all stable references
      handleDashboard,
      handleFilterChange,
      formatDate,
      handleAdminPageChange,

      // Refresh functions with specific limits
      refreshEmployeeDashboard,
      refreshAdminAttendance,
      refreshAdminMyDashboard,
      refreshWeeklyAttendane,
      refreshWeeklyWith100,
      fetchHolidays,
      fetchAdminAttendance,
      fetchEmployeeDashboard,
      fetchLogs,
    }),
    [
      employee,
      employeeAttendance,
      singleAttendance,
      adminAttendance,
      personalAddress,
      setPersonalAddress,
      setAdminAttendance,
      orgAddress,
      setOrgAddress,
      holidays,
      loading,
      initialized,
      profileImage,
      setProfileImage,
      isMyDash,
      setIsMyDash,
      activelogs,
      setActiveLogs,
      singleAdminAttendance,
      setSingleAdminAttendance,
      weeklyLoading,
      weeklyData,
      setWeeklyData,
      adminPagination,
      pagination,
      setPagination,
      filters,
      setFilters,
      showInactive,
      setShowInactive,
      auth,
      handleDashboard,
      handleFilterChange,
      formatDate,
      handleAdminPageChange,
      refreshEmployeeDashboard,
      refreshAdminAttendance,
      refreshAdminMyDashboard,
      refreshWeeklyAttendane,
      refreshWeeklyWith100,
      fetchHolidays,
      fetchAdminAttendance,
      fetchEmployeeDashboard,
      fetchLogs,
    ],
  );

  return (
    <EmployContext.Provider value={contextValue}>
      {children}
    </EmployContext.Provider>
  );
};

export default EmployProvider;