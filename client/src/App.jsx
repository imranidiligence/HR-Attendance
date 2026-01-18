import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";

import Adminlayout from "./layout/Adminlayout";
import Employlayout from "./layout/Employlayout";
import Attendance from "./pages/Attendence";
import Overview from "./pages/Overview";
import ChangePassword from "./pages/ChangePassword";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import Holidays from "./pages/Holidays";
import Profile from "./pages/Profile";
import Employleaves from "./pages/Employleaves";
import Adminleaves from "./pages/Adminleaves";

import Login from "./components/Login";
import Employelist from "./components/Employelist";
import NotFound from "./pages/NotFound";
import AddEmploy from "./components/AddEmploy";

import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));


  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "token") {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Session expired. Please login again.");
          setUser(null); // update state
          window.location.replace("/login");
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Optional: sync user state with localStorage changes
  useEffect(() => {
    const interval = setInterval(() => {
      const storedUser = JSON.parse(localStorage.getItem("user") || "null");
      setUser(storedUser);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <Toaster />
      <Routes>
        {/* ROOT REDIRECT */}
        <Route
          path="/"
          element={
            !user?.role ? (
              <Navigate to="/login" replace />
            ) : user.role === "admin" ? (
              <Navigate to="/admin" replace />
            ) : user.role === "employee" ? (
              <Navigate to="/employee" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* ADMIN */}
        <Route element={<AdminRoute allowedRole="admin" />}>
          <Route path="/admin" element={<Adminlayout />}>
            <Route index element={<Overview />} />
            <Route path="attendance" element={<Attendance/>} /> 
            <Route path="employees" element={<Employelist />} />
            <Route path="add-emp" element={<AddEmploy />} />
            <Route path="leaves" element={<Adminleaves />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
          </Route>
        </Route>

        {/* EMPLOYEE */}
        <Route element={<ProtectedRoute allowedRole="employee" />}>
          <Route path="/employee" element={<Employlayout />}>
            <Route index element={<Overview />} />
            <Route path="attendance" element={<Attendance />} /> 
            <Route path="holidays" element={<Holidays />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="leaves" element={<Employleaves />} />
          </Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
