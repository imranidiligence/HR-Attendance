const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {db} = require("../db/connectDB");
const { isAdmin } = require("../middlewares/roleMiddleware");
const router  = express.Router();


router.get("/employees/reporting/:empCode", authMiddleware, async (req, res) => {
  try {
    const { empCode } = req.params;
    const empCodeStr = empCode; // Keep as string

    // 1️⃣ Fetch employee
    const empCheck = await db.query(
      "SELECT emp_id, name FROM users WHERE emp_id = $1",
      [empCodeStr]
    );
    if (empCheck.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employee = empCheck.rows[0];

    console.log("employee",  employee.emp_id)

    const managersResult = await db.query(
      `SELECT
          m.emp_id AS manager_code,
          m.name AS manager_name,
          er.report_type
       FROM employee_reporting er
       JOIN users m ON m.emp_id = er.reports_to
       WHERE er.emp_id = $1
       ORDER BY 
         CASE er.report_type
           WHEN 'primary' THEN 1
           WHEN 'secondary' THEN 2
           WHEN 'dotted' THEN 3
           ELSE 4
         END`,
      [employee.emp_id] 
    );
    

    console.log("managersResult",managersResult)

    res.json({
      emp_id: employee.emp_id,
      name: employee.name,
      managers: managersResult.rows,
    });
  } catch (error) {
    console.error("Reporting fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});





router.post("/employees/reporting", authMiddleware, isAdmin, async (req, res) => {
  const client = await db.connect();

  try {
    const { emp_code, managers } = req.body;

    // 1️⃣ Validation
    if (!emp_code || !Array.isArray(managers) || managers.length === 0) {
      return res.status(400).json({
        message: "emp_code and managers array are required",
      });
    }

    // 2️⃣ Convert employee code to emp_id
    const empCheck = await client.query(
      "SELECT emp_id FROM users WHERE emp_id = $1",
      [emp_code]
    );

    if (empCheck.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const empId = empCheck.rows[0].emp_id;

    // 3️⃣ Prevent self-reporting
    for (const m of managers) {
      if (m.emp_code === emp_code) {
        return res.status(400).json({
          message: "Employee cannot report to themselves",
        });
      }
    }

    // 4️⃣ Validate managers exist and convert emp_code -> emp_id
    for (const m of managers) {
      const mgrCheck = await client.query(
        "SELECT emp_id FROM users WHERE emp_id = $1",
        [m.emp_code]
      );

      if (mgrCheck.rowCount === 0) {
        return res.status(404).json({ message: `Manager not found: ${m.emp_code}` });
      }

      m.emp_id = mgrCheck.rows[0].emp_id; // store manager emp_id
    }

    await client.query("BEGIN");

    // 5️⃣ Remove existing PRIMARY manager
    await client.query(
      "DELETE FROM employee_reporting WHERE emp_id = $1 AND report_type = 'primary'",
      [empId]
    );

    // 6️⃣ Insert new reporting structure
    for (const m of managers) {
      await client.query(
        `INSERT INTO employee_reporting (emp_id, reports_to, report_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (emp_id, reports_to) DO NOTHING`,
        [empId, m.emp_id, m.report_type || "secondary"]
      );
    }

    await client.query("COMMIT");

    res.status(200).json({
      message: "Reporting structure updated successfully",
      emp_code,
      managers,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reporting update error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});



router.get("/employees/reporting/:emp_id", authMiddleware, async (req, res) => {
  try {
    const { emp_id } = req.params;

    if (!emp_id) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    // Check employee exists
    const empResult = await db.query(
      `SELECT emp_id, name 
       FROM users 
       WHERE emp_id = $1`,
      [emp_id]
    );

    if (empResult.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Fetch reporting managers
    const reportingResult = await db.query(
      `SELECT
         m.emp_id   AS manager_emp_id,
         m.name     AS manager_name,
         er.report_type
       FROM employee_reporting er
       JOIN users m 
         ON m.emp_id = er.reports_to
       WHERE er.emp_id = $1
       ORDER BY 
         CASE er.report_type
           WHEN 'primary' THEN 1
           WHEN 'secondary' THEN 2
           WHEN 'dotted' THEN 3
           ELSE 4
         END`,
      [emp_id]
    );

    res.status(200).json({
      emp_id: empResult.rows[0].emp_id,
      emp_name: empResult.rows[0].name,
      reporting_managers: reportingResult.rows
    });

  } catch (error) {
    console.error("Reporting fetch error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});





  

module.exports = router;