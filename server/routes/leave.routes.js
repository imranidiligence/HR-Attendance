const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {db} = require("../db/connectDB");
const router = express.Router();


// Get Leaves
router.get("/types",authMiddleware,async(req,res)=>{
    try {
        const result = await db.query(
            "SELECT * FROM leave_types WHERE is_active = true ORDER BY name"
          );
          res.json(result.rows);
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Internal Server Error"});
    }
})

// Balance Leaves

router.get("/balance/:emp_id",authMiddleware,async(req,res)=>{
    try {
        const { emp_id } = req.params;
        const year = new Date().getFullYear();
    
        const result = await db.query(
          `
          SELECT 
            lt.name AS leave_type,
            lb.total,
            lb.used,
            lb.remaining
          FROM leave_balances lb
          JOIN leave_types lt ON lt.id = lb.leave_type_id
          WHERE lb.emp_id = $1 AND lb.year = $2
          `,
          [emp_id, year]
        );
    
        res.json(result.rows);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch leave balance" });
      }
})


// Apply Leave

router.post("/apply",authMiddleware,async(req,res)=>{

 
        const client = await db.connect();
        try {
          const {
            emp_id,
            leave_type_id,
            start_date,
            end_date,
            total_days,
            reason,
          } = req.body;
      
          if (!emp_id || !leave_type_id || !start_date || !end_date || !total_days) {
            return res.status(400).json({ message: "Missing required fields" });
          }
      
          await client.query("BEGIN");
      
          // Check balance
          const balanceRes = await client.query(
            `
            SELECT remaining 
            FROM leave_balances 
            WHERE emp_id = $1 AND leave_type_id = $2 AND year = $3
            `,
            [emp_id, leave_type_id, new Date().getFullYear()]
          );
      
          if (balanceRes.rowCount === 0) {
            return res.status(400).json({ message: "Leave balance not found" });
          }
      
          if (balanceRes.rows[0].remaining < total_days) {
            return res.status(400).json({ message: "Insufficient leave balance" });
          }
      
          // Insert leave request
          const leaveRes = await client.query(
            `
            INSERT INTO leave_requests
            (emp_id, leave_type_id, start_date, end_date, total_days, reason)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            `,
            [emp_id, leave_type_id, start_date, end_date, total_days, reason]
          );
      
          const leaveRequestId = leaveRes.rows[0].id;
      
          // Create approval entry (manager)
          await client.query(
            `
            INSERT INTO leave_approvals
            (leave_request_id, approver_role, approval_level)
            VALUES ($1, 'manager', 1)
            `,
            [leaveRequestId]
          );
      
          await client.query("COMMIT");
      
          res.status(201).json({
            message: "Leave applied successfully",
            leave_request_id: leaveRequestId,
          });
    } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ message: "Leave application failed" });
  } 
  finally {
    client.release();
  }
})


// Get My Leaves

router.get("/my/:emp_id",authMiddleware,async(req,res)=>{
    try {
        const { emp_id } = req.params;
    
        const result = await db.query(
          `
          SELECT 
            lr.id,
            lt.name AS leave_type,
            lr.start_date,
            lr.end_date,
            lr.total_days,
            lr.status,
            lr.applied_at
          FROM leave_requests lr
          JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.emp_id = $1
          ORDER BY lr.applied_at DESC
          `,
          [emp_id]
        );
    
        res.json(result.rows);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch leaves" });
      }
})

module.exports = router;