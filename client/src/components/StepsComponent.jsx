import React, { useContext, useMemo, useState } from "react";
import { EmployContext } from "../context/EmployContextProvider";
const formatHolidaysByMonth = (holidays = []) => {
  const monthMap = {};

  holidays.forEach(h => {
    if (!h.is_active) return;

    const dateObj = new Date(h.holiday_date);

    const monthKey = dateObj.toLocaleString("en-IN", {
      month: "long",
      year: "numeric",
    });

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        month: monthKey,
        holidays: [],
      };
    }

    monthMap[monthKey].holidays.push({
      id: h.holiday_date,
      date: dateObj.getDate().toString().padStart(2, "0"),
      name: h.holiday_name,
      type: h.holiday_type.toLowerCase(), // public / national / religious
      description: h.is_paid ? "Paid Holiday" : "Optional Holiday",
      country: "India",
      popular: h.holiday_type === "National",
    });
  });

  return Object.values(monthMap);
};

const HolidayCalendar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { holidays: apiHolidays = [] } = useContext(EmployContext);

  const holidays = useMemo(
    () => formatHolidaysByMonth(apiHolidays),
    [apiHolidays]
  );

 
  const filteredHolidays = useMemo(() => {
    return holidays.map(month => ({
      ...month,
      holidays: month.holidays.filter(h => {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          h.name.toLowerCase().includes(search) ||
          h.description.toLowerCase().includes(search);

        const matchesType =
          filterType === "all" || h.type === filterType;

        return matchesSearch && matchesType;
      }),
    }));
  }, [holidays, searchTerm, filterType]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-4xl font-bold text-[#222F7D] flex items-center justify-center gap-2">
          🎉 Holiday Calendar <span className="text-lg font-medium">(2026)</span>
        </h1>
        <p className="text-gray-600 mt-2">
          View national, public & religious holidays at a glance
        </p>
      </div>

      {/* Search & Filter */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border">

          <input
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#222F7D] focus:outline-none"
            placeholder=" Search holiday name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#222F7D] focus:outline-none"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Holidays</option>
            <option value="public">Public</option>
            <option value="national">National</option>
            <option value="religious">Religious</option>
          </select>
        </div>
      </div>

      {/* Holidays */}
      <div className="max-w-7xl mx-auto space-y-10">
        {filteredHolidays.map(
          (m) =>
            m.holidays.length > 0 && (
              <div key={m.month}>

                {/* Month Header */}
                <div className="flex items-center gap-4 mb-4">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    {m.month}
                  </h2>
                  <div className="flex-1 h-px bg-gray-300" />
                </div>

                {/* Holiday Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {m.holidays.map((h) => (
                    <div
                      key={h.id}
                      className="group bg-white p-5 rounded-xl border shadow-sm hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#222F7D]/10 text-[#222F7D] font-bold text-sm shadow-sm">
                          {h.date}
                        </div>


                        {/* Type Badge */}
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-semibold uppercase
                          ${h.type === "national"
                              ? "bg-green-100 text-green-700"
                              : h.type === "public"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                        >
                          {h.type}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-gray-800 group-hover:text-[#222F7D] transition">
                        {h.name}
                      </h3>

                      {/* Optional description */}
                      {/* 
                    <p className="text-sm text-gray-600 mt-1">
                      {h.description}
                    </p> 
                    */}
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>

  );
};

export default HolidayCalendar;
