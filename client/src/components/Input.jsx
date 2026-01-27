import React from 'react'

const Input = ({ label, disabled, ...props }) => (
  <div className="flex flex-col gap-1">
   <label className="text-sm text-gray-600 ">
  {label?.replace(/_/g, " ")}
</label>


    <input
      {...props}
      disabled={disabled}
      className={`
        border rounded px-3 py-2 text-sm
        transition-colors duration-200
        ${disabled
          ? "bg-gray-100 text-gray-600 cursor-not-allowed"
          : "bg-white text-gray-900"}
        focus:outline-none focus:ring-2 focus:ring-[#222F7D]
      `}
    />
  </div>
);


export default Input