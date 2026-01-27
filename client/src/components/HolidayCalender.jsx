import { IoFlagSharp } from "react-icons/io5";

const getFestivalStyles = (name, isPast) => {
  // ERP style: Muted/Grayed out for historical data
  if (isPast) return "bg-gray-50 border-gray-200 text-gray-400 opacity-60 shadow-none";

  const lowerName = name.toLowerCase();


  if (lowerName.includes("republic") || lowerName.includes("independence") || lowerName.includes("gandhi"))
    return "bg-orange-50/50 border-orange-200 text-slate-800 border-l-4 border-l-orange-500 shadow-sm";

  if (lowerName.includes("eid") || lowerName.includes("ramzan") || lowerName.includes("muharram") || lowerName.includes("nabi"))
    return "bg-emerald-50/50 border-emerald-200 text-slate-800 border-l-4 border-l-emerald-600 shadow-sm";

  if (lowerName.includes("holi") || lowerName.includes("dussehra") || lowerName.includes("govardhan"))
    return "bg-blue-50/50 border-blue-200 text-slate-800 border-l-4 border-l-blue-600 shadow-sm";

  if (lowerName.includes("christmas"))
    return "bg-red-50/50 border-red-200 text-slate-800 border-l-4 border-l-red-600 shadow-sm";

  return "bg-slate-50 border-slate-200 text-slate-800 border-l-4 border-l-[#222F7D] shadow-sm";
};

export default function HolidayTimeline({ data }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextHolidayIndex = data.findIndex(item => new Date(item.holiday_date) >= today);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 max-w-6xl mx-auto shadow-sm">
      {/* ERP Header */}
      <div className="flex items-center justify-between mb-10 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Annual Holiday Calendar</h2>
          <p className="text-sm text-slate-500">Official corporate holiday schedule for 2026</p>
        </div>
        <div className="hidden sm:flex gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-md">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Upcoming
          </span>
        </div>
      </div>

      <div className="relative">

        <div className="absolute left-[18px] top-0 h-full w-[2px] bg-slate-100"></div>

        <div className="space-y-6">
          {data.map((item, index) => {
            const holidayDate = new Date(item.holiday_date);
            const isPast = holidayDate < today;
            const isNext = index === nextHolidayIndex;
            const styles = getFestivalStyles(item.holiday_name, isPast);

            return (
              <div
                key={index}
                className="relative pl-12 group"
                style={{
                  animation: `slideIn 0.4s ease-out ${index * 0.05}s both`
                }}
              >

                <div
                  className={`absolute left-0 top-3 w-9 h-9 rounded-lg flex items-center justify-center z-10 border transition-all duration-500
  ${isPast
                      ? "bg-slate-100 border-slate-200"
                      : "bg-white border-slate-200 shadow-sm"
                    } 
  ${isNext
                      ? "border-[#222F7D] ring-[6px] ring-blue-100/60 shadow-[0_0_15px_rgba(34,47,125,0.2)] animate-pulse-subtle"
                      : ""
                    }`}
                >
                  <IoFlagSharp className={`${isPast ? "text-slate-400" : "text-[#222F7D]"} text-sm`} />
                </div>


                <div className={`rounded-lg p-5 border transition-all hover:bg-white hover:shadow-md ${styles}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xs font-bold tracking-tight px-2 py-0.5 rounded border ${isPast ? "bg-slate-100 border-slate-200 text-slate-400" : "bg-white border-slate-200 text-[#222F7D]"
                          }`}>
                          {new Date(item.holiday_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>

                        {isNext && (
                          <span className="flex items-center gap-1.5 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
                            Next Holiday
                          </span>
                        )}
                      </div>

                      <h3 className={`text-lg font-bold ${isPast ? "text-slate-400" : "text-slate-800"}`}>
                        {item.holiday_name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div className="flex flex-col items-end">
                        {/* <span className={`text-[10px] uppercase font-black tracking-widest ${isPast ? "text-slate-300" : "text-slate-400"}`}>
                          Classification
                        </span> */}
                        <span className={`text-xs font-semibold ${isPast ? "text-slate-400" : "text-slate-600"}`}>
                          {item.holiday_type}
                        </span>
                      </div>
                    </div>
                  </div>

                  {item.remarks && (
                    <div className="mt-3 pt-3 border-t border-slate-200/50">
                      <p className={`text-xs ${isPast ? "text-slate-400" : "text-slate-500"}`}>
                        <span className="font-bold uppercase text-[9px] mr-2">Remarks:</span>
                        {item.remarks}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}