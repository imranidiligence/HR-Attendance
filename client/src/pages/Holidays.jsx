import { Typography } from "@mui/material";
import React, { useContext } from "react";
import HolidayCalendar from "../components/HolidayCalender";
import { EmployContext } from "../context/EmployContextProvider";

const Holidays = () => {

  const {holidays} = useContext(EmployContext);

  // console.log(holidays);
  const timelineData = [
    // ... (same data, unchanged)
  ];

  return (
    <div className="px-2 sm:px-4 pb-6 w-full ">

      {/* Sticky Header */}
      <div className="sticky top-0 left-0 z-20 bg-[#222F7D] rounded-md sm:rounded-lg">
        <Typography className="text-white py-2 sm:py-3 text-lg sm:text-2xl text-center font-semibold">
          Holidays
        </Typography>
      </div>

      {/* Total Holidays */}
      <div className="mt-4 flex justify-center sm:justify-start">
        <h1 className="bg-[#222f7d] text-white rounded-md sm:rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-base sm:text-xl">
          Total Holidays : {holidays.length}
        </h1>
      </div>

      {/* Calendar Wrapper */}
      <div className="w-full mt-4 flex justify-center overflow-x-auto">
        <div className="">
          <HolidayCalendar data={holidays} />
        </div>
      </div>

    </div>
  );
};

export default Holidays;
