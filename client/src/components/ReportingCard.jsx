import React from 'react'

const ReportingCard = ({reportingManagers}) => {

    // console.log("reportingManagers",reportingManagers)
  return (
   <>
<div className="mt-4 w-full">
  <h3 className="text-md font-semibold text-gray-800 mb-2">
    Reporting To
  </h3>

  <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
    {reportingManagers?.length > 0 ? (
      reportingManagers.map((mgr, index) => (
        <div
          key={index}
          className="flex justify-between items-center"
        >
          <div>
            <p className="font-medium text-gray-900">
              {mgr.manager_name}
            </p>
            <p className="text-sm text-gray-600">
              {mgr.manager_code}
            </p>
          </div>

          {/* <span className="text-xs font-semibold text-gray-700 uppercase">
            {mgr.report_type}
          </span> */}
        </div>
      ))
    ) : (
      <p className="text-sm text-gray-500">
        No reporting manager assigned
      </p>
    )}
  </div>
</div>

   </>

  )
}

export default ReportingCard