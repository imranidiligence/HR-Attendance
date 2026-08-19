import React, { useContext, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { EmployContext } from "../context/EmployContextProvider";

const MonthlyHolidays = () => {
  const now = new Date();
  const currentMonth = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const formatHolidayDate = (isoDate) => {
    const date = new Date(isoDate);
  
    return {
      day: date.toLocaleDateString("en-IN", { day: "2-digit" }),
      month: date.toLocaleDateString("en-IN", { month: "short" }),
      weekday: date.toLocaleDateString("en-IN", { weekday: "long" }),
    };
  };
  

  const {holidays} = useContext(EmployContext);

  useEffect(()=>{
    // console.log("holidays",holidays)
  },[holidays])

  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());

  const upcomingHolidays = holidays.filter((holiday)=>{
    const hDate = new Date(holiday.holiday_date);
    
    return hDate >= today
  }).sort((a,b)=> new Date(a.holiday_date) - new Date(b.holiday_date));

  
  // console.log("holidays",holidays)
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm lg:mt-3">
    {/* Header Section: Column on mobile, Row on desktop */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <h2 className="text-lg font-semibold text-gray-700">
        Upcoming Holidays – <span className="text-blue-600">{currentMonth}</span>
      </h2>
  
      <NavLink
        to="/employee/holidays"
        className="text-center bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition text-sm font-medium shadow-sm active:scale-95"
      >
        View All
      </NavLink>
    </div>
  
    {upcomingHolidays.length === 0 ? (
      <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-lg">
         <p className="text-sm text-gray-400 font-medium">No holidays this month 🎉</p>
      </div>
    ) : (
      /* Grid: 1 col on mobile, 2 on tablet, 3 on desktop */
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {upcomingHolidays.slice(0, 6).map((holiday, index) => {
          const { day, month, weekday } = formatHolidayDate(holiday.holiday_date);
  
          return (
            <li
              key={index}
              className="flex gap-4 items-center p-3 sm:p-4 bg-gray-50 border border-gray-100 rounded-xl hover:shadow-md transition-shadow group"
            >
              {/* Date Box: Keep fixed size to prevent shrinking */}
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 group-hover:bg-blue-700 text-white rounded-lg flex flex-col items-center justify-center transition-colors">
                <span className="text-sm font-bold leading-none">{day}</span>
                <span className="text-[10px] uppercase font-semibold mt-1">{month}</span>
              </div>
  
              {/* Holiday Info */}
              <div className="min-w-0"> {/* min-w-0 prevents text overflow in flex containers */}
                <p className="font-bold text-gray-800 text-sm sm:text-base truncate">
                  {holiday.holiday_name}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="font-medium text-blue-500">{weekday}</span> 
                  <span>•</span> 
                  <span className="truncate">{holiday.holiday_type}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </section>

  );
};

export default MonthlyHolidays;
