const express = require("express");
const router = express.Router();

const {
  getActiveEmployeeCount,
  getActive_Present_EmployeeCount,
  getActive_Absent_EmployeeCount,
  getActive_Employee_Department_Count,
  getWeeklyEmployeesData,
  getEmployeeWeeklyPieChartData,
  getMonthlyEmployeesData,
  getYearlyEmployeesData
} = require("../controllers/DashboardController");

router.get("/active/count", getActiveEmployeeCount);
router.get("/active_Present/count",getActive_Present_EmployeeCount);
router.get("/active_Absent/count",getActive_Absent_EmployeeCount);
router.get("/active_Department/count",getActive_Employee_Department_Count);
router.get("/weekly/:emp_id", getWeeklyEmployeesData);
router.get("/weekly-pie/:emp_id", getEmployeeWeeklyPieChartData);
router.get("/monthly/:emp_id", getMonthlyEmployeesData);
router.get("/yearly/:emp_id", getYearlyEmployeesData);

module.exports = router;