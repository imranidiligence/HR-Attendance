import React, { useContext, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { EmployContext } from "../context/EmployContextProvider";
import "../components/Charts";

const AttendanceBarChart = ({ cardData = [] }) => {
  const { adminAttendance = [], loading } = useContext(EmployContext);

  // 🔹 Derive counts from adminAttendance - Filter for active users only
  const stats = useMemo(() => {
    // If cardData is provided and has data, use it
    if (cardData && cardData.length > 0) {
      const total = cardData.find(item => item.title === "Total Employees")?.total || 0;
      const present = cardData.find(item => item.title === "Present Today")?.total || 0;
      const absent = cardData.find(item => item.title === "Absent Today")?.total || 0;
      
      return [
        { title: "Total Employee", total, bgColor: "#4331cc" },
        { title: "Present", total: present, bgColor: "#27F598" },
        { title: "Absent", total: absent, bgColor: "#ff4d4f" },
      ];
    }

    // Fallback: Filter adminAttendance for active users
    const activeEmployees = adminAttendance.filter(
      (emp) => emp.is_active === true
    );

    const total = activeEmployees.length;
    const present = activeEmployees.filter(
      i => i.status === "Present" || i.status === "Working"
    ).length;
    const absent = activeEmployees.filter(
      i => i.status === "Absent"
    ).length;

    return [
      { title: "Total Employee", total, bgColor: "#4331cc" },
      { title: "Present", total: present, bgColor: "#27F598" },
      { title: "Absent", total: absent, bgColor: "#ff4d4f" },
    ];
  }, [adminAttendance, cardData]);

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => ({
    labels: stats.map(i => i.title),
    datasets: [
      {
        label: "Employees",
        data: stats.map(i => i.total),
        backgroundColor: stats.map(i => i.bgColor),
        borderRadius: 8,
        barThickness: 40,
      },
    ],
  }), [stats]);

  // Memoize options
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.raw} Employees`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          precision: 0,
        },
      },
    },
  }), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[260px] text-gray-500">
        Loading chart...
      </div>
    );
  }

  if (!adminAttendance.length) {
    return (
      <div className="flex items-center justify-center h-[260px] text-gray-500">
        No attendance data
      </div>
    );
  }

  return (
    <div className="w-full h-[260px]">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default React.memo(AttendanceBarChart);