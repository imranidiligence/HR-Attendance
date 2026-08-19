import React, { useState } from "react";

const statusColors = {
  present: "bg-green-500",
  absent: "bg-red-500",
  leave: "bg-yellow-400",
  holiday: "bg-blue-500",
};

  
const YearCalendar = ({ year, holidays=[], attendanceData, employeesOnDay }) => {
  const [selectedMonth, setSelectedMonth] = useState(null);

  
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const getMonthDays = (monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    return { firstDay, totalDays };
  };

  return (
    <>
      {/* Year Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {months.map((month, index) => {
          const { firstDay, totalDays } = getMonthDays(index);

          return (
            <div
              key={month}
              className="border rounded-lg p-4 bg-white shadow-sm cursor-pointer"
              onClick={() => setSelectedMonth(index)}
            >
              <h3 className="text-center font-semibold mb-2">{month}</h3>

              <div className="grid grid-cols-7 text-xs text-black mb-1">
                {days.map((d) => (
                  <span key={d} className="text-center">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-sm">
                {Array(firstDay).fill(null).map((_, i) => (
                  <span key={i} />
                ))}

{[...Array(totalDays || 0)].map((_, d) => {
  const month = String(index + 1).padStart(2, "0");
  const day = String(d + 1).padStart(2, "0");
  const date = `${year}-${month}-${day}`;

  const status = attendanceData?.[date];
  const employeeCount = employeesOnDay?.[date];
  // console.log(date, attendanceData[date]);

  return (
    <div
      key={d}
      className={`relative text-center py-1 rounded cursor-pointer text-black
        ${
          status === "present"
            ? "bg-green-500"
            : status === "absent"
            ? "bg-red-500"
            : status === "leave"
            ? "bg-yellow-400 text-black"
            : status === "holiday"
            ? "bg-blue-500"
            : "hover:bg-gray-100 text-gray-700"
        }`}
    >
      {d + 1}

      {employeeCount && (
        <span className="absolute bottom-1 right-1 w-2 h-2 bg-black rounded-full" />
      )}
    </div>
  );
})}

              </div>
            </div>
          );
        })}
      </div>

      {/* Month Detail Modal */}
      {/* {selectedMonth !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[90%] max-w-lg">
            <h2 className="text-lg font-semibold mb-4">
              {months[selectedMonth]} {year}
            </h2>

            <p className="text-sm text-gray-600">
               Detailed daily attendance view here  
              (Present / Absent / Leave / Employee list)
            </p>

            <button
              onClick={() => setSelectedMonth(null)}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )} */}
    </>
  );
};

export default YearCalendar;
