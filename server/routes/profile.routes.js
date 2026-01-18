
const express = require("express");
const auth = require("../middlewares/authMiddleware");
const { db } = require("../db/connectDB");
const { getOrganizationInfo } = require("../controllers/profile.controller");
const router = express.Router();

// Organization
router.post("/:emp_id", auth, getOrganizationInfo);


// Personal

router.post("/personal/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    const {
      gender,
      dob,
      bloodgroup,
      maritalstatus,
      nationality,
      address,
      aadharnumber,
      nominee
    } = req.body;

    // ✅ Required fields (nominee optional)
    if (
      !gender ||
      !dob ||
      !bloodgroup ||
      !maritalstatus ||
      !nationality ||
      !address ||
      !aadharnumber
    ) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }

    // ✅ Aadhaar basic validation
    if (String(aadharnumber).length !== 12) {
      return res.status(400).json({ message: "Invalid Aadhaar number" });
    }

    // ✅ Prevent duplicate personal details
    const existing = await db.query(
      `SELECT 1 FROM personal WHERE emp_id = $1`,
      [emp_id]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Personal details already exist" });
    }

    // ✅ Correct INSERT query
    const result = await db.query(
      `
      INSERT INTO personal
      (gender, dob, bloodgroup, maritalstatus, nationality, address, aadharnumber, nominee, emp_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        gender,
        dob,
        bloodgroup,
        maritalstatus,
        nationality,
        address,
        aadharnumber,
        nominee || null, // ✅ allow NULL
        emp_id
      ]
    );

    res.status(201).json({
      message: "Personal details created successfully",
      personalDetails: result.rows[0],
    });

  } catch (error) {
    console.error("Personal details error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/personal/:emp_id",auth,async(req,res)=>{
  try {

    const {emp_id} = req.params;

    const result = await db.query(
      `
      SELECT * FROM personal 
      WHERE emp_id = $1
      `,
      [emp_id]
    )

    res.status(200).json({message:"Personal Data Fetched",personalDetails:result.rows[0]});

  } catch (error) {
    console.log(error);
    res.status(500).json({message:"Internal Server Error"});
  }
})

router.put("/personal/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    const {
      gender,
      dob,
      bloodgroup,
      maritalstatus,
      nationality,
      address,
      aadharnumber,
      nominee,
    } = req.body;

    // Validation
    if (
      !gender ||
      !dob ||
      !bloodgroup ||
      !maritalstatus ||
      !nationality ||
      !address ||
      !aadharnumber ||
      !nominee
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const result = await db.query(
      `
      UPDATE personal
      SET
        gender = $1,
        dob = $2,
        bloodgroup = $3,
        maritalstatus = $4,
        nationality = $5,
        address = $6,
        aadharnumber = $7,
        nominee = $8
      WHERE emp_id = $9
      RETURNING *
      `,
      [
        gender,
        dob,
        bloodgroup,
        maritalstatus,
        nationality,
        address,
        aadharnumber,
        nominee,
        emp_id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({
      message: "Personal details updated successfully",
      personalDetails: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});





// Education - In-Process
// POST Request
router.post("/education/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    // Authorization
    if (req.user.role === "employee" && req.user.emp_id !== emp_id) {
      return res.status(403).json({ message: "Unauthorized" });
    }


    // Correct normalization
    const educationArray = Array.isArray(req.body)
      ? req.body
      : req.body.education
      ? Array.isArray(req.body.education)
        ? req.body.education
        : [req.body.education]
      : [req.body];

    if (!educationArray.length) {
      return res.status(400).json({ message: "Education data is required" });
    }

    const inserted = [];

    for (const edu of educationArray) {
      const {
        degree,
        field_of_study,
        institution_name,
        university,
        passing_year,
        percentage_or_grade,
      } = edu;

      if (
        !degree ||
        !field_of_study ||
        !institution_name ||
        !university ||
        !passing_year
      ) {
        return res
          .status(400)
          .json({ message: "All education fields are required" });
      }

      const { rows } = await db.query(
        `
        INSERT INTO education
          (emp_id, degree, field_of_study, institution_name, university, passing_year, percentage_or_grade)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          emp_id,
          degree,
          field_of_study,
          institution_name,
          university,
          passing_year,
          percentage_or_grade || null,
        ]
      );

      inserted.push(rows[0]);
    }

    res.status(201).json({
      message: "Education added successfully",
      education: inserted,
    });
  } catch (error) {
    console.error("[ERROR] /education POST:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



// GET Request
router.get("/education/:emp_id", auth, async (req, res) => {
    try {
      const { emp_id } = req.params;
  
      const { rows } = await db.query(
        `
        SELECT
            id,
          degree,
          field_of_study,
          institution_name,
          university,
          passing_year,
          percentage_or_grade
        FROM education
        WHERE emp_id = $1
        ORDER BY passing_year DESC
        `,
        [emp_id]
      );
  
      if (!rows.length) {
        return res.status(404).json({ message: "No education records found" });
      }
  
      res.status(200).json({
        total: rows.length,
        education: rows
      });
  
    } catch (error) {
      console.error("[ERROR] /education/:emp_id GET:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
});
  
// PUT Request 
router.put("/education/:emp_id/:id", auth, async (req, res) => {
  try {
    const { emp_id, id } = req.params;

    // Authorization
    if (req.user.role === "employee" && req.user.emp_id !== emp_id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const {
      degree,
      field_of_study,
      institution_name,
      university,
      passing_year,
      percentage_or_grade,
    } = req.body;

    // Validation
    if (
      !degree ||
      !field_of_study ||
      !institution_name ||
      !university ||
      !passing_year
    ) {
      return res.status(400).json({
        message: "All education fields are required",
      });
    }

    const { rowCount, rows } = await db.query(
      `
      UPDATE education
      SET
        degree = $1,
        field_of_study = $2,
        institution_name = $3,
        university = $4,
        passing_year = $5,
        percentage_or_grade = $6,
        updated_at = NOW()
      WHERE id = $7
        AND emp_id = $8
      RETURNING *
      `,
      [
        degree,
        field_of_study,
        institution_name,
        university,
        passing_year,
        percentage_or_grade || null,
        id,
        emp_id,
      ]
    );

    if (!rowCount) {
      return res.status(404).json({
        message: "Education record not found",
      });
    }

    res.status(200).json({
      message: "Education updated successfully",
      education: rows[0],
    });
  } catch (error) {
    console.error("[ERROR] /education PUT:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE Request 
router.delete("/education/:emp_id/:id", auth, async (req, res) => {
  try {
    const { emp_id, id } = req.params;

    // Authorization
    if (req.user.role === "employee" && req.user.emp_id !== emp_id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { rowCount } = await db.query(
      `
      DELETE FROM education
      WHERE id = $1
        AND emp_id = $2
      `,
      [id, emp_id]
    );

    if (!rowCount) {
      return res.status(404).json({
        message: "Education record not found",
      });
    }

    res.status(200).json({
      message: "Education deleted successfully",
    });
  } catch (error) {
    console.error("[ERROR] /education DELETE:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});




// Contact API 

// POST Request
router.post("/contact/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    const {
      contact_type,
      phone,
      email,
      relation,
      is_primary
    } = req.body;

    // Validation
    if (!contact_type || !phone || !email || !relation) {
      return res.status(400).json({
        message: "All required fields are mandatory"
      });
    }

    // Authorization (employee can add own contact, admin can add all)
    if (req.user.emp_id !== emp_id && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Unauthorized access"
      });
    }

    const result = await db.query(
      `
      INSERT INTO contact (
        emp_id,
        contact_type,
        phone,
        email,
        relation,
        is_primary
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        emp_id,
        contact_type,
        phone,
        email,
        relation,
        is_primary ?? false
      ]
    );

    res.status(201).json({
      message: "Contact created successfully",
      contact: result.rows[0]
    });

  } catch (error) {
    console.error("Create contact error:", error);
    res.status(500).json({
      message: "Internal Server Error"
    });
  }
});

// GET Request
router.get("/contact/:emp_id",auth,async(req,res)=>{
  try{

    const {emp_id} = req.params;

    const result = await  db.query(
      `
      Select * from contact
      where emp_id = $1
      `,
      [emp_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "No contacts found for this employee",
        contacts: []
      });
    }

    res.status(200).json({message:"Contact Fetched",contact:result.rows});
  }catch(err){
    console.log(err);
    res.status(500).json({message:"Internal Server Error"});
  }
})

// PUT Request
router.put("/contact/:emp_id",auth,async(req,res)=>{
  try {
    
  } catch (error) {
    console.log(error);
    res.status(500).json({message:"Internal Server Error"});
  }
})

// BANK API

router.post("/bank/:emp_id", auth, async (req, res) => {
  try {
    const emp_id = req.params.emp_id;

    const {
      account_holder_name,
      bank_name,
      account_number,
      ifsc_code,
      branch_name,
      upi_id,
      account_type,
      isActive = true,
      pan_number,
    } = req.body;

    // Validate required fields
    if (!account_holder_name || !bank_name || !account_number || !ifsc_code || !branch_name) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    // Insert into bank_accounts table
    const result = await db.query(
      `INSERT INTO bank_accounts
      (employee_id, account_holder_name, bank_name, account_number, ifsc_code, branch_name, upi_id, account_type, pan_number, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        emp_id,
        account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        branch_name,
        upi_id,
        account_type,
        pan_number,
        isActive
      ]
    );

    res.status(201).json({
      message: "Bank details added successfully",
      bankInfo: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/bank/:emp_id",auth,async(req,res)=>{
  try {

    const {emp_id} = req.params;

    const result = await db.query(
      `Select * from bank_accounts
        where employee_id = $1
      `
      ,[emp_id]
    )

    res.status(200).json({bankInfo:result.rows[0]})
  } catch (error) {
    console.log(error);
    res.status(500).json({message:"Internal Server Error"})
  }
})

router.put("/bank/:emp_id", auth, async (req, res) => {
  
  try {
    const { emp_id } = req.params;

    const {
      account_holder_name,
      bank_name,
      account_number,
      ifsc_code,
      branch_name,
      upi_id,
      account_type,
      pan_number,
      is_active
    } = req.body;

    // Basic validation
    if (
      !account_holder_name ||
      !bank_name ||
      !account_number ||
      !ifsc_code ||
      !account_type ||
      !pan_number
    ) {
      return res.status(400).json({
        message: "Required bank fields are missing"
      });
    }

    //  Authorization (employee can update own data, admin can update all)
    if (
      req.user.emp_id !== emp_id 
      // &&
      // req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Unauthorized access"
      });
    }

    const result = await db.query(
      `
      UPDATE bank_accounts
      SET
        account_holder_name = $1,
        bank_name = $2,
        account_number = $3,
        ifsc_code = $4,
        branch_name = $5,
        upi_id = $6,
        account_type = $7,
        pan_number = $8,
        is_active = $9,
        updated_at = NOW()
      WHERE employee_id = $10
      RETURNING *
      `,
      [
        account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        branch_name || null,
        upi_id || null,
        account_type,
        pan_number,
        is_active ?? true,
        emp_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Bank details not found for this employee"
      });
    }

    // Mask sensitive data in response
    const responseData = {
      ...result.rows[0],
      account_number: `XXXXXX${result.rows[0].account_number.slice(-4)}`
    };

    res.status(200).json({
      message: "Bank details updated successfully",
      data: responseData
    });

  } catch (error) {
    console.error("Update bank details error:", error);
    res.status(500).json({
      message: "Internal Server Error"
    });
  }
});


  
  
  
  

module.exports = router;
