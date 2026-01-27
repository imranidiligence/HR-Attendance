const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {getMyAttendance,getMyTodayAttendance, getMyHolidays} = require("../controllers/attendance.controller");
const {db} = require("../db/connectDB");
const { isAdmin } = require("../middlewares/roleMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

function formatAttendance(rawLogs, employeeMap) {
    const grouped = {};
  
    // 1Group logs by deviceUserId
    rawLogs.forEach(log => {
      const empId = log.deviceUserId;
      const time = new Date(log.recordTime);
  
      if (!grouped[empId]) {
        grouped[empId] = [];
      }
  
      grouped[empId].push(time);
    });
  
    // Build UI response
    const result = [];
  
    Object.keys(grouped).forEach(empId => {
      const times = grouped[empId].sort((a, b) => a - b);
  
      result.push({
        name: employeeMap[empId] || "Unknown",
        device_user_id: empId,
        punch_in: times[0].toISOString(),
        punch_out: times[times.length - 1].toISOString()
      });
    });
  
    return result;
  }
  

// Employ Punch In  &  Punch Out

router.get("/today",auth,getMyTodayAttendance)

// Employ all previous attendence view

router.get("/history",auth,getMyAttendance);

// Holiday 

router.get("/holiday",auth,getMyHolidays);

// Get All Employees 

router.get("/all-emp", authMiddleware, isAdmin, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM users`);
    res.status(200).json(result.rows); // return all employees
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



module.exports = router;
