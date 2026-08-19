import React, { useContext, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { centerTextPlugin } from "../components/CenterTextPlugin";
import { EmployContext } from "../context/EmployContextProvider";

// Utility: "HH:MM" → decimal hours
const hhmmToHours = (val) => {
  if (!val || val === "--") return 0;
  const [h, m] = val.split(":").map(Number);
  return h + m / 60;
};

const AttendanceDoughnutChart = ({ cardData = [], employData = [] }) => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role?.toLowerCase();

  const { adminAttendance = [], loading } = useContext(EmployContext);

  /* ================= ADMIN ================= */
  const adminStats = useMemo(() => {
    // If cardData is provided and has data, use it
    if (cardData && cardData.length > 0) {
      const total = cardData.find(item => item.title === "Total Employees")?.total || 0;
      const present = cardData.find(item => item.title === "Present Today")?.total || 0;
      const absent = cardData.find(item => item.title === "Absent Today")?.total || 0;
      
      return { total, present, absent };
    }
    
    // Fallback: filter adminAttendance for active users
    const activeEmployees = adminAttendance.filter(
      (emp) => emp.is_active === true
    );
    
    const total = activeEmployees.length || 1;
    const present = activeEmployees.filter(
      (e) => e.status === "Present" || e.status === "Working"
    ).length;
    const absent = total - present;

    return { total, present, absent };
  }, [adminAttendance, cardData]);

  // Memoize admin chart data
  const adminChartData = useMemo(() => ({
    labels: ["Present", "Absent"],
    datasets: [
      {
        data: [adminStats.present, adminStats.absent],
        backgroundColor: ["#27F598", "#EF4444"],
        borderWidth: 0,
      },
    ],
  }), [adminStats.present, adminStats.absent]);

  /* ================= EMPLOYEE ================= */
  const employeeData = useMemo(() => {
    const workedHHMM = employData.find((i) => i.title === "Total Hours")?.value || "00:00";
    const workedHours = hhmmToHours(workedHHMM);
    const expectedHours = 9.5;
    const remaining = Math.max(expectedHours - workedHours, 0);
    const empPercentage = Math.min(
      Math.round((workedHours / expectedHours) * 100),
      100
    );

    return {
      workedHours,
      remaining,
      empPercentage,
    };
  }, [employData]);

  // Memoize employee chart data
  const empChartData = useMemo(() => ({
    labels: ["Worked", "Remaining"],
    datasets: [
      {
        data: [employeeData.workedHours, employeeData.remaining],
        backgroundColor: ["#4331cc", "#e5e7eb"],
        borderWidth: 0,
      },
    ],
  }), [employeeData.workedHours, employeeData.remaining]);

  // Memoize options
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: { position: "bottom" },
    },
  }), []);

  if (loading) return null;

  const adminPercentage = adminStats.total > 0 
    ? Math.round((adminStats.present / adminStats.total) * 100)
    : 0;

  return (
    <div className="flex items-center justify-center w-full h-full">
      {/* ADMIN */}
      {role === "admin" && (
        <div className="w-[280px] h-[280px]">
          <Doughnut
            data={adminChartData}
            options={options}
            plugins={[
              centerTextPlugin(
                `${adminPercentage}%`,
                "Present",
                "#27F598",
                "#555"
              ),
            ]}
          />
        </div>
      )}

      {/* EMPLOYEE */}
      {role !== "admin" && (
        <div className="w-[260px] h-[260px]">
          <Doughnut
            data={empChartData}
            options={options}
            plugins={[
              centerTextPlugin(
                `${employeeData.empPercentage}%`,
                "Worked",
                "#4331cc",
                "#555"
              ),
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(AttendanceDoughnutChart);