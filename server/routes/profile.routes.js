
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const auth = require("../middlewares/authMiddleware");
const { db } = require("../db/connectDB");
const { getOrganizationInfo } = require("../controllers/profile.controller");
const { isAdmin } = require("../middlewares/roleMiddleware");
const uploadBankDoc = require("../middlewares/uploadBankDoc");
const uploadProfileImage = require("../middlewares/uploadProfileImage");
const sendEmail = require("../utils/mailer");
const router = express.Router();

// Organization
router.post("/organization", auth, getOrganizationInfo);


router.get("/organization", auth, async (req, res) => {
// Log this to see if Admin is reaching the controller
console.log("User from token:", req.user);
  try {

    // const {emp_id} = req.params;
    const result = await db.query(
      `
      SELECT * FROM organizations 
      `
    )

    res.status(200).json({ message: "Personal Data Fetched", organizationDetails: result.rows[0] });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
})


//  Only Admin Can Update Organization

router.put("/organization", auth, isAdmin, async (req, res) => {
  try {
    // const { emp_id } = req.params;

    const {
      organization_name,
      organization_code,
      industry_type,
      address,
      city,
      state,
      country,
      is_Active,
    } = req.body;

    const result = await db.query(
      `
        UPDATE organizations
        SET
          organization_name = $1,
          organization_code = $2,
          industry_type = $3,
          address = $4,
          city = $5,
          state = $6,
          country = $7,
          is_active = $8
        RETURNING *
        `,
      [
        organization_name,
        organization_code,
        industry_type,
        address,
        city,
        state,
        country,
        is_Active,

      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({
      message: "Organization details updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Organization Update Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
);

// Personal
// ---------- DOB PARSER ----------
const parseDob = (dob) => {
  // Already correct format → YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return dob;
  }

  // Convert DD/MM/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
    const [day, month, year] = dob.split("/");
    return `${year}-${month}-${day}`;
  }

  throw new Error("Invalid DOB format");
};


// ---------- POST PERSONAL DETAILS ----------
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
      nominee,
      department, 
    } = req.body;

    // ---------- Validation ----------
    if (
      !gender ||
      !dob ||
      !bloodgroup ||
      !maritalstatus ||
      !nationality ||
      !address ||
      !aadharnumber ||
      !department
    ) {
      return res.status(400).json({
        message: "All required fields must be filled",
      });
    }

    // ---------- Normalize DOB ----------
    let formattedDob;
    try {
      formattedDob = parseDob(dob); // YYYY-MM-DD
    } catch {
      return res.status(400).json({ message: "Invalid DOB format" });
    }

    // ---------- Prevent Duplicate ----------
    const exists = await db.query(
      "SELECT 1 FROM personal WHERE emp_id = $1",
      [emp_id]
    );

    if (exists.rowCount > 0) {
      return res
        .status(409)
        .json({ message: "Personal details already exist" });
    }

    // ---------- Insert ----------
    const result = await db.query(
      `
      INSERT INTO personal (
        emp_id,
        gender,
        dob,
        bloodgroup,
        maritalstatus,
        nationality,
        address,
        aadharnumber,
        nominee,
        department
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
      `,
      [
        emp_id,
        gender,
        formattedDob,
        bloodgroup,
        maritalstatus,
        nationality,
        address,
        aadharnumber,
        nominee || null,
        department,
      ]
    );

    res.status(201).json({
      message: "Personal details created successfully",
      personalDetails: result.rows[0],
    });
  } catch (error) {
    console.error("Personal POST error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/personal/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;
      
    const result = await db.query(
      `
      SELECT
        u.emp_id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.profile_image,
        u.shift_id,
        TO_CHAR(p.dob, 'DD-MM-YYYY') as dob,           -- Formats to DD-MM-YYYY
        p.gender,
        p.department,
        TO_CHAR(p.joining_date, 'DD-MM-YYYY') as joining_date, -- Formats to DD-MM-YYYY
        p.maritalstatus,
        p.nominee,
        p.aadharnumber,
        p.bloodgroup,
        p.nationality,
        p.address
      FROM users u
      LEFT JOIN personal p
        ON u.emp_id = p.emp_id
      WHERE u.emp_id = $1
      `,
      [emp_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Now returns: { "dob": "05-10-2000", "joining_date": "12-05-2026", ... }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/personal/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;
    // Destructure everything you need from req.body
    const { 
      dob, 
      joining_date, 
      gender, 
      department, 
      bloodgroup, 
      maritalstatus, 
      nationality, 
      nominee, 
      aadharnumber, 
      address 
    } = req.body;

    const toDbDate = (str) => {
      if (!str || !str.includes("-")) return null;
      const [d, m, y] = str.split("-");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    };

    const formattedDob = toDbDate(dob);
    const formattedJoiningDate = toDbDate(joining_date);

    // Update query
    const result = await db.query(
      `UPDATE personal 
       SET 
         dob = $1, 
         joining_date = $2, 
         gender = $3, 
         department = $4,
         bloodgroup = $5,
         maritalstatus = $6,
         nationality = $7,
         nominee = $8,
         aadharnumber = $9,
         address = $10
       WHERE emp_id = $11 
       RETURNING *`,
      [
        formattedDob,
        formattedJoiningDate,
        gender,
        department,
        bloodgroup,
        maritalstatus,
        nationality,
        nominee,
        aadharnumber,
        address,
        emp_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // ===== SEND PROFILE UPDATED EMAIL =====
    try {
      await sendEmail(req.user.email, "Profile Updated", "profile_update", {
        name: req.user.name,
        section: "Personal"
      });
      console.log(` Profile update email sent to ${req.user.email}`);
    } catch (emailErr) {
      console.error(" Error sending profile update email:", emailErr);
    }

    res.status(200).json(result.rows[0]);
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

    console.log("Education POST body:", req.body);

    console.log("emp_id",emp_id)
    console.log("req.user.emp_id", req.user.emp_id)

    // --------- Authorization ----------
    if (req.user.role === "employee" && req.user.emp_id !== emp_id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // --------- Normalize payload ----------
    // Accept single object or array of objects
    let educationArray = [];

    if (Array.isArray(req.body)) {
      educationArray = req.body;
    } else if (req.body.education) {
      educationArray = Array.isArray(req.body.education)
        ? req.body.education
        : [req.body.education];
    } else if (typeof req.body === "object" && Object.keys(req.body).length > 0) {
      educationArray = [req.body];
    }

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

      // Optional: validation for required fields
      // if (!degree || !field_of_study || !institution_name || !university || !passing_year) {
      //   return res.status(400).json({ message: "All required education fields must be filled" });
      // }

      const { rows } = await db.query(
        `
        INSERT INTO education
          (emp_id, degree, field_of_study, institution_name, university, passing_year, percentage_or_grade)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          emp_id,
          degree || null,
          field_of_study || null,
          institution_name || null,
          university || null,
          passing_year || null,
          percentage_or_grade || null,
        ]
      );

      inserted.push(rows[0]);
    }

    console.log("inserted",inserted);

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
    // console.log("Education GET Route Call ")
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

    console.log("Education PUT Route Call", req.body);

    // --------- Authorization ----------
    if (req.user.role === "employee" && req.user.emp_id !== emp_id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // --------- Destructure payload ----------
    const {
      degree,
      field_of_study,
      institution_name,
      university,
      passing_year,
      percentage_or_grade,
    } = req.body;

    // Optional validation: at least one field must be provided
    if (
      !degree &&
      !field_of_study &&
      !institution_name &&
      !university &&
      !passing_year &&
      !percentage_or_grade
    ) {
      return res.status(400).json({
        message: "At least one field is required to update",
      });
    }

    // --------- Update query ----------
    const { rowCount, rows } = await db.query(
      `
      UPDATE education
      SET
        degree = COALESCE($1, degree),
        field_of_study = COALESCE($2, field_of_study),
        institution_name = COALESCE($3, institution_name),
        university = COALESCE($4, university),
        passing_year = COALESCE($5, passing_year),
        percentage_or_grade = COALESCE($6, percentage_or_grade),
        updated_at = NOW()
      WHERE id = $7
        AND emp_id = $8
      RETURNING *
      `,
      [
        degree || null,
        field_of_study || null,
        institution_name || null,
        university || null,
        passing_year || null,
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

    // ===== SEND PROFILE UPDATED EMAIL =====
    try {
      await sendEmail(req.user.email, "Profile Updated", "profile_update", {
        name: req.user.name,
        section: "Education"
      });
      console.log(`✅ Profile update email sent to ${req.user.email}`);
    } catch (emailErr) {
      console.error("❌ Error sending profile update email:", emailErr);
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
    console.log("Education Delete Route Call ")
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


// Experience

// CREATE
router.post("/experience/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    console.log(req.body);
    const {
      company_name,
      designation,
      start_date,
      end_date,
      total_years,
    } = req.body;

    console.log( company_name,
      designation,
      start_date,
      end_date,
      total_years)

    if (!company_name || !designation) {
      return res.status(400).json({
        message: "Company name and designation are required",
      });
    }

    const result = await db.query(
      `
      INSERT INTO experience
        (emp_id, company_name, designation, start_date, end_date, total_years)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [emp_id, company_name, designation, start_date, end_date, total_years]
    );

    res.status(201).json({
      message: "Experience created successfully",
      experience: result.rows[0],
    });
  } catch (error) {
    console.error("Create experience error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// UPDATE
router.put("/experience/:emp_id/:id", auth, async (req, res) => {
  try {
    const { emp_id, id } = req.params;
    const {
      company_name,
      designation,
      start_date,
      end_date,
      total_years,
    } = req.body;

    console.log(req.body);

    if (!company_name || !designation) {
      return res.status(400).json({
        message: "Company name and designation are required",
      });
    }

    const result = await db.query(
      `
      UPDATE experience
      SET company_name = $1,
          designation = $2,
          start_date = $3,
          end_date = $4,
          total_years = $5,
          updated_at = NOW()
      WHERE id = $6 AND emp_id = $7
      RETURNING *
      `,
      [
        company_name,
        designation,
        start_date,
        end_date,
        total_years,
        id,
        emp_id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Experience not found",
      });
    }

    // ===== SEND PROFILE UPDATED EMAIL =====
    try {
      await sendEmail(req.user.email, "Profile Updated", "profile_update", {
        name: req.user.name,
        section: "Experience"
      });
      console.log(`✅ Profile update email sent to ${req.user.email}`);
    } catch (emailErr) {
      console.error("❌ Error sending profile update email:", emailErr);
    }

    res.status(200).json({
      message: "Experience updated successfully",
      experience: result.rows[0],
    });
  } catch (error) {
    console.error("Update experience error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


router.delete("/experience/:emp_id/:id", auth, async (req, res) => {
  try {
    const { emp_id, id } = req.params;

    const result = await db.query(
      `
      DELETE FROM experience
      WHERE id = $1 AND emp_id = $2
      RETURNING *
      `,
      [id, emp_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Experience not found",
      });
    }

    res.status(200).json({
      message: "Experience deleted successfully",
      deletedExperience: result.rows[0],
    });
  } catch (error) {
    console.error("Delete experience error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// Get 
router.get("/experience/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    const { rows } = await db.query(
      `
      SELECT
        id,
        emp_id,
        company_name,
        designation,
        start_date,
        end_date,
        total_years
      FROM experience
      WHERE emp_id = $1
      ORDER BY start_date DESC
      `,
      [emp_id]
    );

    // ✅ ALWAYS return 200
    res.status(200).json({
      total: rows.length,
      experience: rows, // [] if empty → frontend safe
    });

  } catch (error) {
    console.error("Get experience error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});





// Contact API 


// GET Request
router.get("/contact/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    const result = await db.query(
      `SELECT * FROM contact WHERE emp_id = $1`,
      [emp_id]
    );

    res.status(200).json({
      contacts: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



// PUT Request
// Update all contacts for an employee
router.put("/contact/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;
    const { contact_type, phone, email, relation, is_primary } = req.body;

    // Check if this specific email already exists for this employee
    const existing = await db.query(
      `SELECT emp_id FROM contact WHERE emp_id = $1 AND email = $2`,
      [emp_id, email]
    );

    let contactRecord;

    if (existing.rowCount > 0) {
      // UPDATE
      const { rows } = await db.query(
        `UPDATE contact
         SET contact_type = $1, phone = $2, relation = $3, is_primary = $4, created_at = NOW()
         WHERE emp_id = $5 AND email = $6
         RETURNING *`,
        [contact_type, phone, relation || null, is_primary ?? false, emp_id, email]
      );

      contactRecord = rows[0];

      // Send email after successful update
      await sendEmail(req.user.email, "Profile Updated", "profile_update", {
        name: req.user.name,
        section: "Contact"
      });

      return res.status(200).json({ message: "Updated", contact: contactRecord });
    } else {
      // INSERT
      const { rows } = await db.query(
        `INSERT INTO contact (emp_id, contact_type, phone, email, relation, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [emp_id, contact_type, phone, email, relation || null, is_primary ?? false]
      );

      contactRecord = rows[0];

      // Send email after successful insert
      await sendEmail(req.user.email, "Profile Updated", "profile_update", {
        name: req.user.name,
        section: "Contact"
      });

      return res.status(201).json({ message: "Inserted", contact: contactRecord });
    }
  } catch (err) {
    console.error("Manual Upsert Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

















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
      is_active = true,
      pan_number,
    } = req.body;

    if (!account_holder_name || !bank_name || !account_number || !ifsc_code || !branch_name) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    const result = await db.query(
      `
      INSERT INTO bank_accounts (
        employee_id, account_holder_name, bank_name, account_number, ifsc_code, branch_name, upi_id, account_type, pan_number, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (employee_id)
      DO UPDATE SET
        account_holder_name = EXCLUDED.account_holder_name,
        bank_name = EXCLUDED.bank_name,
        account_number = EXCLUDED.account_number,
        ifsc_code = EXCLUDED.ifsc_code,
        branch_name = EXCLUDED.branch_name,
        upi_id = EXCLUDED.upi_id,
        account_type = EXCLUDED.account_type,
        pan_number = EXCLUDED.pan_number,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
      `,
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
        is_active
      ]
    );

    res.status(201).json({
      message: "Bank details saved successfully",
      bankInfo: result.rows[0],
    });
  } catch (error) {
    console.error("Bank save error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/bank/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    const result = await db.query(
      `SELECT * FROM bank_accounts WHERE employee_id = $1`,
      [emp_id]
    );

    res.status(200).json({
      bankDetails: result.rows   
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


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

    // Authorization (employee can update own data, admin can update all)
    if (req.user.emp_id !== emp_id) {
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

    // ======= SEND PROFILE UPDATED EMAIL =======
    try {
      await sendEmail(req.user.email, "Profile Updated", "profile_update", {
        name: req.user.name,
        section: "Bank"
      });
      console.log(`Profile update email sent to ${req.user.email}`);
    } catch (emailErr) {
      console.error(" Error sending profile update email:", emailErr);
    }

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


// Document Upload Api 

router.post(
  "/bank/doc/:emp_id",
  auth,
  (req, res, next) => {
    uploadBankDoc(req, res, (err) => {
      if (err) {
        // Multer error handling
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ message: err.message });
        }
        return res.status(500).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { emp_id } = req.params;

      // console.log(req.files);

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedDocs = [];

      for (const field in req.files) {
        const file = req.files[field][0];

        const result = await db.query(
          `
          INSERT INTO bank_documents (
            bank_account_id,
            file_type,
            file_name,
            file_path,
            file_size,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (bank_account_id, file_type)
          DO UPDATE SET
            file_name = EXCLUDED.file_name,
            file_path = EXCLUDED.file_path,
            file_size = EXCLUDED.file_size,
            updated_at = NOW()
          RETURNING *;
          `,
          [
            emp_id,
            file.fieldname,
            file.originalname,
            `/uploads/bank-docs/${file.filename}`,
            file.size,
          ]
        );

        uploadedDocs.push(result.rows[0]);
      }

      res.status(201).json({
        message: "Bank documents uploaded successfully",
        documents: uploadedDocs,
      });
    } catch (error) {
      console.error("Bank Doc Upload Error:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);
// GET all bank documents for an employee
router.get("/bank/doc/:emp_id", auth, async (req, res) => {
  try {
    const { emp_id } = req.params;

    // Fetch documents from DB
    const result = await db.query(
      `
      SELECT bank_account_id, file_type, file_name, file_path, file_size, created_at, updated_at
      FROM bank_documents
      WHERE bank_account_id = $1
      ORDER BY created_at ASC
      `,
      [emp_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No documents found" });
    }

    res.status(200).json({
      emp_id,
      documents: result.rows,
    });
  } catch (error) {
    console.error("Bank Documents GET Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



// Profile Image


router.post(
  "/image/",
  auth,
  uploadProfileImage.single("profile"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Image is required" });
      }

      const emp_id = req.user.emp_id;
      const imagePath = `/uploads/profile-images/${req.file.filename}`;

      // Delete old image if exists
      const oldImageResult = await db.query(
        `SELECT profile_image FROM users WHERE emp_id = $1`,
        [emp_id]
      );
      const oldImagePath = oldImageResult.rows[0]?.profile_image;
      if (oldImagePath) {
        const fullPath = path.join(__dirname, "..", oldImagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlink(fullPath, (err) => {
            if (err) console.error("Failed to delete old profile image:", err);
          });
        } else {
          console.log("Old profile image not found, skipping deletion");
        }
      }

      // Update DB
      await db.query(
        `UPDATE users SET profile_image = $1 WHERE emp_id = $2`,
        [imagePath, emp_id]
      );

      res.status(200).json({
        message: oldImagePath ? "Profile image updated successfully" : "Profile image added successfully",
        profile_image: imagePath,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);








// GET /api/employee/profile/image
router.get("/image", auth, async (req, res) => {
  try {
    const emp_id = req.user.emp_id;

    const result = await db.query(
      `SELECT profile_image FROM users WHERE emp_id = $1`,
      [emp_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileImage = result.rows[0].profile_image;

    // Return full URL if image exists
    const fullImageUrl = profileImage
      ? `${req.protocol}://${req.get("host")}${profileImage}`
      : null;

    res.status(200).json({
      profile_image: fullImageUrl, // null if no image
    });
  } catch (error) {
    console.error("Fetch profile image error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


module.exports = router;
