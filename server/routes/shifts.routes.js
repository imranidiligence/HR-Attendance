const express = require("express");
const { isAdmin } = require("../middlewares/roleMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");
const {db} = require("../db/connectDB");

const router = express.Router();


router.post("/employee-shifts",authMiddleware,async(req,res)=>{
    try {
        const { emp_id, shift_id, shift_name,effective_from, effective_to } = req.body;

        console.log(req.body);
    
        if (!emp_id || !shift_id || !effective_from) {
          return res.status(400).json({ message: "emp_id, shift_id, and effective_from are required" });
        }
    
        const result = await db.query(
          `INSERT INTO employee_shifts (emp_id, shift_id, shift_name,effective_from, effective_to)
           VALUES ($1, $2, $3, $4,$5)
           RETURNING *`,
          [emp_id, shift_id,shift_name, effective_from, effective_to || null]
        );
    
        res.json({ success: true, data: result.rows[0] });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }

})
router.get("/all-employee-shifts", authMiddleware, async (req, res) => {
    try {
      const targetDate = req.query.date || new Date().toISOString().split("T")[0]; // default today
  
      const { rows } = await db.query(`
        SELECT 
            u.emp_id,
            u.name AS employee_name,
            sh.id AS shift_id,
            sh.name AS shift_name,
            sh.start_time,
            sh.end_time,
            sh.grace_minutes,
            sh.half_day_hours,
            sh.full_day_hours
        FROM users u
        LEFT JOIN employee_shifts es
            ON es.emp_id = u.emp_id
            AND es.is_active = TRUE
            AND es.effective_from <= $1
            AND (es.effective_to IS NULL OR es.effective_to >= $1)
        LEFT JOIN shifts sh
            ON sh.id = es.shift_id
        ORDER BY u.emp_id;
      `, [targetDate]);
  
      res.json({ success: true, date: targetDate, employees: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  });
  


module.exports = router;