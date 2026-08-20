const express = require("express");
const router = express.Router();

const {
  getActiveEmployeeCount,
  getActive_Present_EmployeeCount,
  getActive_Absent_EmployeeCount,
  getActive_Employee_Department_Count
} = require("../controllers/DashboardController");

router.get("/active/count", getActiveEmployeeCount);
router.get("/active_Present/count",getActive_Present_EmployeeCount);
router.get("/active_Absent/count",getActive_Absent_EmployeeCount);
router.get("/active_Department/count",getActive_Employee_Department_Count);

module.exports = router;