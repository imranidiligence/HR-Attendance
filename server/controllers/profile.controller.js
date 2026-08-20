const fs = require("fs");
const multer = require("multer");
const path = require("path");
const auth = require("../middlewares/authMiddleware");
const { db } = require("../db/connectDB");
const sendEmail = require("../utils/mailer");
const sendNotification = require("../services/notification.services");
// Organization

/*

address
: 
"Patel Arcade 2,Juna Bazar,City Chowk Chh.Sambhaji Nagar"
city
: 
"Chh.Sambhaji Nagar (Aurangabad)"
country
: 
"india"
created_at
: 
"2026-01-14T11:54:45.187Z"
industry_type
: 
"Enterprise Software & Digital Transformation"
is_active
: 
null
organization_code
: 
"IDILIGENCE"
organization_name
: 
"Idiligence Solution"
state
: 
"Maharashtra"
*/

exports.addOrganizationInfo = async (req, res) => {
  const { employee_id } = req.params;
  const client = await db.connect();

  try {
    const {
      organization_name,
      organization_code,
      industry_type,
      organization_location,
      city,
      state,
      country,

      employee_type_id,
      reporting_location_id,

      organization_email,
      department_id,
      designation_id,

      joining_date,
      leaving_date,

      official_email_id,
      official_contact_no,

      reporting_to_id,
      employeeidoforganisation
    } = req.body;

    // ---------- Validation ----------
    // if (
    //   !organization_name ||
    //   !organization_code ||
    //   !industry_type ||
    //   !department_id ||
    //   !designation_id
    // ) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Required fields are missing"
    //   });
    // }

    await client.query("BEGIN");

    // Leaving date determines active status
    const isActive = leaving_date ? false : true;

    // ---------- Organization ----------
    const orgResult = await client.query(
      `
      INSERT INTO organizations (
        organization_name,
        organization_code,
        industry_type,
        organization_location,
        city,
        state,
        country,
        is_active,
        employee_type_id,
        employee_id,
        reporting_location_id,
        organization_email,
        department_id,
        designation_id,
        joining_date,
        leaving_date,
        official_email_id,
        official_contact_no,
        reporting_to_id,
        employeeidoforganisation
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING *
      `,
      [
        organization_name,
        organization_code,
        industry_type,
        organization_location,
        city,
        state,
        country,
        isActive,
        employee_type_id,
        employee_id,
        reporting_location_id,
        organization_email,
        department_id,
        designation_id,
        joining_date || null,
        leaving_date || null,
        official_email_id,
        official_contact_no,
        reporting_to_id || null,
        employeeidoforganisation
      ]
    );

    // ---------- Reporting ----------
    const reportingResult = await client.query(
      `
      INSERT INTO employee_reporting (
        emp_id,
        reports_to
      )
      VALUES ($1, $2)
      ON CONFLICT (emp_id)
      DO UPDATE SET
        reports_to = EXCLUDED.reports_to
      RETURNING *
      `,
      [
        employee_id,
        reporting_to_id || null
      ]
    );

    // ---------- Update users active status ----------
    await client.query(
      `
      UPDATE users
      SET is_active = $1
      WHERE emp_id = $2
      `,
      [isActive, employee_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Organization information updated successfully",
      organizationData: orgResult.rows[0],
      reportingData: reportingResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Organization POST error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });

  } finally {
    client.release();
  }
};

exports.getOrganizationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    // ---------- Organization ----------
    const orgResult = await db.query(
      `
      SELECT
        organization_name,
        organization_code,
        industry_type,
        organization_location,
        city,
        state,
        country,
        is_active,
        created_at,
        id,
        employee_type_id,
        employee_id,
        reporting_location_id,
        organization_email,
        department_id,
        designation_id,
        joining_date,
        leaving_date,
        official_email_id,
        official_contact_no,
        reporting_to_id,
        employeeidoforganisation
      FROM organizations
      WHERE employee_id = $1
      `,
      [employee_id]
    );

    // ---------- Reporting ----------
    const reportingResult = await db.query(
      `
      SELECT
        emp_id,
        reports_to
      FROM employee_reporting
      WHERE emp_id = $1
      `,
      [employee_id]
    );

    if (!orgResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Organization information not found"
      });
    }

    return res.status(200).json({
      success: true,
      organizationData: orgResult.rows[0],
      reportingData: reportingResult.rows[0] || {}
    });

  } catch (error) {
    console.error("Get Organization Info error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

exports.updateOrganizationInfo = async (req, res) => {
  const { employee_id } = req.params;
  const client = await db.connect();

  try {
    const {
      organization_name,
      organization_code,
      industry_type,
      organization_location,
      city,
      state,
      country,

      employee_type_id,
      employee_id,
      reporting_location_id,

      organization_email,
      department_id,
      designation_id,

      joining_date,
      leaving_date,

      official_email_id,
      official_contact_no,

      reporting_to_id,
      employeeidoforganisation
    } = req.body;

    // ---------- Validation ----------
    // if (
    //   !organization_name ||
    //   !organization_code ||
    //   !industry_type ||
    //   !department_id ||
    //   !designation_id
    // ) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Required fields are missing"
    //   });
    // }

    await client.query("BEGIN");

    // ---------- Active Status ----------
    const isActive = leaving_date ? false : true;

    // ---------- Update Organization ----------
    const orgResult = await client.query(
      `
      UPDATE organizations
      SET
        organization_name = $1,
        organization_code = $2,
        industry_type = $3,
        organization_location = $4,
        city = $5,
        state = $6,
        country = $7,
        is_active = $8,
        employee_type_id = $9,
        employee_id = $10,
        reporting_location_id = $11,
        organization_email = $12,
        department_id = $13,
        designation_id = $14,
        joining_date = $15,
        leaving_date = $16,
        official_email_id = $17,
        official_contact_no = $18,
        reporting_to_id = $19,
        employeeidoforganisation = $20
      WHERE employee_id = $21
      RETURNING *
      `,
      [
        organization_name,
        organization_code,
        industry_type,
        organization_location,
        city,
        state,
        country,
        isActive,
        employee_type_id,
        employee_id || employee_id,
        reporting_location_id,
        organization_email,
        department_id,
        designation_id,
        joining_date || null,
        leaving_date || null,
        official_email_id,
        official_contact_no,
        reporting_to_id || null,
        employeeidoforganisation,
        employee_id
      ]
    );

    if (orgResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Organization information not found"
      });
    }

    // ---------- Update Users Active Status ----------
    await client.query(
      `
      UPDATE users
      SET is_active = $1
      WHERE emp_id = $2
      `,
      [isActive, employee_id]
    );

    // ---------- Update Reporting ----------
    const reportingResult = await client.query(
      `
      INSERT INTO employee_reporting (
        emp_id,
        reports_to
      )
      VALUES ($1, $2)
      ON CONFLICT (emp_id)
      DO UPDATE SET
        reports_to = EXCLUDED.reports_to
      RETURNING *
      `,
      [
        employee_id,
        reporting_to_id || null
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Organization information updated successfully",
      organizationData: orgResult.rows[0],
      reportingData: reportingResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update Organization Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });

  } finally {
    client.release();
  }
};

// Personal
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

exports.addPersonInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const {
      gender,
      dob,
      bloodgroup,
      maritalstatus,
      nationality,
      aadharnumber,
      nominee,
      department,
      designation,
      first_name,
      last_name,
      email,
      nationality_id, 
      gender_id, 
      marital_status_id, 
      blood_group_id
    } = req.body;

    console.log("employ id",employee_id)

    // console.log("department",department);
    // ---------- Validation ----------
    // if (
    //  !first_name || !last_name || !email
    // ) {
    //   return res.status(400).json({
    //     message: "All required fields must be filled",
    //   });
    // }

    const parseDob = (dateStr) => {
      if (!dateStr) return null;

      // Agar frontend se DD-MM-YYYY aa raha hai (e.g. 11-12-2000)
      const parts = dateStr.split("-");

      if (parts[0].length === 2) {
        // DD-MM-YYYY -> YYYY-MM-DD
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
      }

      return dateStr; // Agar pehle se YYYY-MM-DD hai
    };

    // Usage in Controller
    let formattedDob;
    try {
      formattedDob = parseDob(req.body.dob); // Ab ye SQL ke liye "2000-12-11" return karega
    } catch (err) {
      return res.status(400).json({ message: "Invalid DOB format" });
    }

    // ---------- Prevent Duplicate ----------
    const exists = await db.query(
      "SELECT 1 FROM personal WHERE employee_id = $1",
      [employee_id]
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
        gender,
        dob,
        bloodgroup,
        maritalstatus,
        nationality,
        aadharnumber,
        nominee,
        department,
        designation,
        first_name,
        last_name,
        email,
        nationality_id, 
        gender_id, 
        marital_status_id, 
        blood_group_id,
        employee_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12,$13,$14,$15,$16,$17)
      RETURNING *
      `,
      [
        gender,
        formattedDob,
        bloodgroup,
        maritalstatus,
        nationality,
        aadharnumber,
        nominee || null,
        department,
        designation,
        first_name,
        last_name,
        email,
        nationality_id, 
        gender_id, 
        marital_status_id, 
        blood_group_id,
        employee_id
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
}

exports.getPersonalInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const result = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.profile_image,
        u.shift_id,

        TO_CHAR(p.dob, 'DD-MM-YYYY') AS dob,

        p.gender,
        p.gender_id,

        p.bloodgroup,
        p.blood_group_id,

        p.maritalstatus,
        p.marital_status_id,

        p.nationality,
        p.nationality_id,

        p.current_address,
        p.permanent_address,

        p.aadharnumber,
        p.nominee,

        p.department,

        TO_CHAR(p.joining_date, 'DD-MM-YYYY') AS joining_date,

        p.designation,

        TO_CHAR(p.leaving_date, 'DD-MM-YYYY') AS leaving_date,

        p.employee_type,
        p.reporting_location,
        p.contact,

        p.first_name,
        p.last_name,
        p.email AS personal_email

      FROM users u
      LEFT JOIN personal p
        ON u.id = p.employee_id
      WHERE u.id = $1
      `,
      [employee_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Employee not found"
      });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    console.error("Get Personal Info error:", error);

    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

exports.updatePersonalInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const {
      first_name,
      last_name,
      email,
      contact,
      dob,
      gender,
      gender_id,
      maritalstatus,
      marital_status_id,
      nationality,
      nationality_id,
      bloodgroup,
      blood_group_id,
      current_address,
      permanent_address,
      aadharnumber,
      nominee,
      department,
      joining_date,
      designation,
      leaving_date,
      employee_type,
      reporting_location
    } = req.body;

    // ---------- Date Parser ----------
    const parseDate = (dateStr) => {
      if (!dateStr) return null;

      const parts = dateStr.split("-");

      // DD-MM-YYYY -> YYYY-MM-DD
      if (parts.length === 3 && parts[0].length === 2) {
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
      }

      return dateStr;
    };

    const formattedDob = parseDate(dob);
    const formattedJoiningDate = parseDate(joining_date);
    const formattedLeavingDate = parseDate(leaving_date);

    // ---------- Validation ----------
    // if (!first_name || !last_name || !email) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "First name, last name and email are required"
    //   });
    // }

    // ---------- Update users table ----------
    const fullName = `${first_name || ""} ${last_name || ""}`.trim();

    await db.query(
      `
      UPDATE users
      SET
        name = $1,
        email = $2
      WHERE emp_id = $3
      `,
      [
        fullName,
        email,
        employee_id
      ]
    );

    // ---------- Update personal table ----------
    const result = await db.query(
      `
      UPDATE personal
      SET
        first_name = $1,
        last_name = $2,
        email = $3,
        contact = $4,
        dob = $5,
        gender = $6,
        gender_id = $7,
        maritalstatus = $8,
        marital_status_id = $9,
        nationality = $10,
        nationality_id = $11,
        bloodgroup = $12,
        blood_group_id = $13,
        current_address = $14,
        permanent_address = $15,
        aadharnumber = $16,
        nominee = $17,
        department = $18,
        joining_date = $19,
        designation = $20,
        leaving_date = $21,
        employee_type = $22,
        reporting_location = $23

      WHERE emp_id = $24

      RETURNING *
      `,
      [
        first_name,
        last_name,
        email,
        contact,
        formattedDob,
        gender,
        gender_id,
        maritalstatus,
        marital_status_id,
        nationality,
        nationality_id,
        bloodgroup,
        blood_group_id,
        current_address,
        permanent_address,
        aadharnumber,
        nominee,
        department,
        formattedJoiningDate,
        designation,
        formattedLeavingDate,
        employee_type,
        reporting_location,
        employee_id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Personal details not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Update Personal Info Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};



// Education
exports.addEducationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    // console.log("Education",req.body);
    
    // console.log("emp_id Add Education", emp_id)

    if(!employee_id){
      return res.status(400).json({message:"employee_id required"});
    }


    // console.log("req.user.emp_id,emp_id",req.user.emp_id,emp_id)

    // if (req.user.role === "employee" && req.user.emp_id !== emp_id) {
    //   return res.status(403).json({ message: "Unauthorized" });
    // }

    let educationArray = [];

    // --- FIX STARTS HERE ---
    if (typeof req.body.education === 'string') {
      // If it's a string (from FormData), parse it back into an array
      educationArray = JSON.parse(req.body.education);
    } else if (Array.isArray(req.body.education)) {
      educationArray = req.body.education;
    } else if (Array.isArray(req.body)) {
      educationArray = req.body;
    } else if (typeof req.body === "object" && Object.keys(req.body).length > 0) {
      educationArray = [req.body];
    }
    // --- FIX ENDS HERE ---

    if (!educationArray.length) {
      return res.status(400).json({ message: "Education data is required" });
    }

    const inserted = [];

    for (const edu of educationArray) {
      // Now 'edu' will be an object like { degree: "Degress", ... }
      const {
        // degree,
        field_of_study,
        institution_name,
        university,
        passing_year,
        percentage_or_grade,
        degree_id
      } = edu;

      const { rows } = await db.query(
        `
        INSERT INTO education
          (employee_id, field_of_study, institution_name, university, passing_year, percentage_or_grade, degree_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          employee_id,
          field_of_study || null,
          institution_name || null,
          university || null,
          passing_year || null,
          percentage_or_grade || null,
          degree_id || null,  
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
};

exports.getEducationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const empIdInt = parseInt(employee_id, 10);

    if (isNaN(empIdInt)) {
      return res.status(400).json({
        message: "Invalid employee ID"
      });
    }

    const { rows } = await db.query(
      `
      SELECT
        employee_id,
        degree,
        degree_id,
        field_of_study,
        institution_name,
        university,
        percentage_or_grade,
        passing_year,
        id,
        updated_at,
        marksheet_url
      FROM education
      WHERE employee_id = $1
      ORDER BY passing_year DESC NULLS LAST, id DESC
      `,
      [empIdInt]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "No education records found"
      });
    }

    return res.status(200).json({
      total: rows.length,
      education: rows
    });

  } catch (error) {
    console.error("[ERROR] /education/:emp_id GET:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

exports.updateEducationInfo = async (req, res) => {
  const client = await db.connect();

  try {
    const { employee_id } = req.params;

    if (!req.body.education) {
      return res.status(400).json({
        message: "Education data is required"
      });
    }

    let educationEntries;

    try {
      educationEntries = JSON.parse(req.body.education);
    } catch (error) {
      return res.status(400).json({
        message: "Invalid education JSON format"
      });
    }

    if (!Array.isArray(educationEntries)) {
      return res.status(400).json({
        message: "Education data must be an array"
      });
    }

    await client.query("BEGIN");

    for (let i = 0; i < educationEntries.length; i++) {
      const edu = educationEntries[i];

      let finalPath = edu.marksheet_url || null;

      // Check file upload for this education row
      const file = req.files?.find(
        (f) => f.fieldname === `file_${i}`
      );

      if (file) {
        finalPath = `/uploads/education/${file.filename}`;
      }

      // ------------------------------------------------
      // Check required fields
      // ------------------------------------------------
      if (!edu.degree && !edu.degree_id) {
        throw new Error(`Degree is required for education row ${i + 1}`);
      }

      // ------------------------------------------------
      // If no ID, check whether record already exists
      // ------------------------------------------------
      if (!edu.id) {
        let checkExist;

        if (edu.degree_id) {
          checkExist = await client.query(
            `
            SELECT id
            FROM education
            WHERE employee_id = $1
              AND degree_id = $2
              AND passing_year = $3
            LIMIT 1
            `,
            [
              emp_id,
              edu.degree_id,
              edu.passing_year || null
            ]
          );
        } else {
          checkExist = await client.query(
            `
            SELECT id
            FROM education
            WHERE employee_id = $1
              AND degree = $2
              AND passing_year = $3
            LIMIT 1
            `,
            [
              employee_id,
              edu.degree,
              edu.passing_year || null
            ]
          );
        }

        if (checkExist.rows.length > 0) {
          edu.id = checkExist.rows[0].id;
        }
      }

      // ------------------------------------------------
      // UPDATE existing education
      // ------------------------------------------------
      if (edu.id) {
        const updateResult = await client.query(
          `
          UPDATE education
          SET
            degree = $1,
            degree_id = $2,
            field_of_study = $3,
            institution_name = $4,
            university = $5,
            percentage_or_grade = $6,
            passing_year = $7,
            marksheet_url = COALESCE($8, marksheet_url),
            updated_at = NOW()
          WHERE id = $9
            AND employee_id = $10
          RETURNING *
          `,
          [
            edu.degree || null,
            edu.degree_id || null,
            edu.field_of_study || null,
            edu.institution_name || null,
            edu.university || null,
            edu.percentage_or_grade || null,
            edu.passing_year || null,
            finalPath,
            edu.id,
            employee_id
          ]
        );

        if (updateResult.rowCount === 0) {
          throw new Error(
            `Education record with ID ${edu.id} was not found for employee ${employee_id}`
          );
        }

      } else {
        // ------------------------------------------------
        // INSERT new education
        // ------------------------------------------------
        await client.query(
          `
          INSERT INTO education (
            employee_id,
            degree,
            degree_id,
            field_of_study,
            institution_name,
            university,
            percentage_or_grade,
            passing_year,
            marksheet_url,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, NOW()
          )
          `,
          [
            employee_id,
            edu.degree || null,
            edu.degree_id || null,
            edu.field_of_study || null,
            edu.institution_name || null,
            edu.university || null,
            edu.percentage_or_grade || null,
            edu.passing_year || null,
            finalPath
          ]
        );
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Education information processed successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Education Update Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error"
    });

  } finally {
    client.release();
  }
};

exports.deleteEducationInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;

    const educationId = Number(id);

    // Validate education ID
    if (isNaN(educationId)) {
      return res.status(400).json({
        message: "Invalid Education ID format"
      });
    }

    // Authorization
    // if (
    //   req.user.role === "employee" &&
    //   String(req.user.emp_id) !== String(emp_id)
    // ) {
    //   return res.status(403).json({
    //     message: "Access Denied: You cannot delete this record"
    //   });
    // }

    const result = await db.query(
      `
      DELETE FROM education
      WHERE id = $1
        AND employee_id = $2
      RETURNING id
      `,
      [educationId, employee_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Record not found or already deleted"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Education record deleted successfully"
    });

  } catch (error) {
    console.error(
      `[ERROR] Delete Education (Emp: ${req.params.emp_id}, ID: ${req.params.id}):`,
      error
    );

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

// Experience

exports.addExperienceInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const {
      company_name,
      designation,
      start_date,
      end_date,
      total_years,
      location,
      designation_id
    } = req.body;

    // 1. Check for Missing Required Fields
    // if (!company_name || !designation || !start_date || !end_date || !location) {
    //   return res.status(400).json({
    //     message: "All fields (Company, Designation, Dates, and Location) are required",
    //   });
    // }

    // 2. Validate Date Formats
    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid date format provided",
      });
    }

    // 3. Logical Validation: End Date cannot be before Start Date
    if (end < start) {
      return res.status(400).json({
        message: "End date cannot be earlier than start date",
      });
    }

    // 4. Sanitize Inputs (Optional but recommended: prevent excessive string lengths)
    // if (company_name.length > 255 || designation.length > 255) {
    //   return res.status(400).json({
    //     message: "Company name or designation is too long",
    //   });
    // }

    // 5. Database Insertion
    const result = await db.query(
      `
      INSERT INTO experience 
        (employee_id, company_name, designation, start_date, end_date, total_years, location, designation_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
      `,
      [employee_id, company_name.trim(), designation.trim(), start_date, end_date, total_years, location.trim(), designation_id]
    );

    // Send Notification
    // sendNotification(emp_id, "New Experience Added", req.user.name);

    res.status(201).json({
      message: "Experience created successfully",
      experience: result.rows[0],
    });
  } catch (error) {
    console.error("Create experience error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getExperienceInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    if (!employee_id) {
      return res.status(400).json({
        message: "Employee ID is required"
      });
    }

    const { rows } = await db.query(
      `
      SELECT
        id,
        employee_id,
        company_name,
        designation,
        designation_id,
        start_date,
        end_date,
        total_years,
        location
      FROM experience
      WHERE employee_id = $1
      ORDER BY start_date DESC NULLS LAST, id DESC
      `,
      [employee_id]
    );

    // Always return 200 so frontend can safely handle []
    return res.status(200).json({
      total: rows.length,
      experience: rows
    });

  } catch (error) {
    console.error("Get experience error:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

exports.updateExperienceInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;

    const {
      company_name,
      designation,
      designation_id,
      start_date,
      end_date,
      total_years,
      location
    } = req.body;

    // ---------- Required Fields ----------
    // if (
    //   !company_name ||
    //   !designation ||
    //   !designation_id ||
    //   !start_date ||
    //   !end_date ||
    //   !location
    // ) {
    //   return res.status(400).json({
    //     message: "All required fields are required"
    //   });
    // }

    // ---------- Validate Dates ----------
    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: "Invalid date format"
      });
    }

    // ---------- Validate Date Order ----------
    if (end < start) {
      return res.status(400).json({
        message: "End date cannot be earlier than start date"
      });
    }

    // ---------- Update ----------
    const result = await db.query(
      `
      UPDATE experience
      SET
        company_name = $1,
        designation = $2,
        designation_id = $3,
        start_date = $4,
        end_date = $5,
        total_years = $6,
        location = $7
      WHERE id = $8
        AND employee_id = $9
      RETURNING *
      `,
      [
        company_name.trim(),
        designation.trim(),
        designation_id,
        start_date,
        end_date,
        total_years,
        location.trim(),
        id,
        employee_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Experience record not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Experience updated successfully",
      experience: result.rows[0]
    });

  } catch (error) {
    console.error("Update experience error:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

exports.deleteExperienceInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;

    const experienceId = Number(id);

    if (isNaN(experienceId)) {
      return res.status(400).json({
        message: "Invalid Experience ID"
      });
    }

    const result = await db.query(
      `
      DELETE FROM experience
      WHERE id = $1
        AND employee_id = $2
      RETURNING *
      `,
      [experienceId, employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Experience not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Experience deleted successfully",
      deletedExperience: result.rows[0]
    });

  } catch (error) {
    console.error("Delete experience error:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

exports.getContactInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    const result = await db.query(
      `
      SELECT
        employee_id,
        contact_type,
        contact_type_id,
        phone,
        email,
        relation,
        is_primary,
        created_at,
        id
      FROM contact
      WHERE employee_id = $1
      ORDER BY is_primary DESC, id ASC
      `,
      [employee_id]
    );

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      contacts: result.rows
    });

  } catch (error) {
    console.error("Get Contact Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};
exports.addContactInfo = async (req, res) => {
  const { employee_id } = req.params;
  const newContact = req.body;

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Get existing contacts
    const currentContactsRes = await client.query(
      `
      SELECT
        contact_type,
        contact_type_id,
        phone,
        email,
        relation,
        is_primary
      FROM contact
      WHERE employee_id = $1
      `,
      [employee_id]
    );

    const existingContacts = currentContactsRes.rows;

    // Combine existing + new contact
    const incomingContacts = Array.isArray(newContact)
      ? newContact
      : [newContact];

    const updatedList = [
      ...existingContacts,
      ...incomingContacts
    ];

    // ------------------------------------------------
    // Validate only one primary contact
    // ------------------------------------------------
    const primaryContacts = updatedList.filter(
      contact => contact.is_primary === true
    );

    if (primaryContacts.length > 1) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Only one contact can be marked as primary."
      });
    }

    // ------------------------------------------------
    // Validate duplicate emails
    // ------------------------------------------------
    const emails = updatedList
      .map(contact => contact.email?.trim().toLowerCase())
      .filter(Boolean);

    const uniqueEmails = new Set(emails);

    if (uniqueEmails.size !== emails.length) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Duplicate emails found in contact list."
      });
    }

    // Delete existing records
    await client.query(
      `DELETE FROM contact WHERE employee_id = $1`,
      [employee_id]
    );

    // ------------------------------------------------
    // Bulk Insert
    // ------------------------------------------------
    if (updatedList.length > 0) {
      const values = [];

      const placeholders = updatedList
        .map((contact, i) => {
          const offset = i * 7;

          values.push(
            employee_id,
            contact.contact_type || null,
            contact.contact_type_id || null,
            contact.phone || null,
            contact.email?.trim().toLowerCase() || null,
            contact.relation || null,
            contact.is_primary ?? false
          );

          return `(
            $${offset + 1},
            $${offset + 2},
            $${offset + 3},
            $${offset + 4},
            $${offset + 5},
            $${offset + 6},
            $${offset + 7},
            NOW()
          )`;
        })
        .join(",");

      await client.query(
        `
        INSERT INTO contact (
          employee_id,
          contact_type,
          contact_type_id,
          phone,
          email,
          relation,
          is_primary,
          created_at
        )
        VALUES ${placeholders}
        `,
        values
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Contact added successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Add Contact Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });

  } finally {
    client.release();
  }
};
exports.updateContactInfo = async (req, res) => {
  const { employee_id } = req.params;
  const contacts = req.body;

  if (!Array.isArray(contacts)) {
    return res.status(400).json({
      success: false,
      message: "Invalid data format. Expected an array."
    });
  }

  const client = await db.connect();

  try {
    // ------------------------------------------------
    // Validate Primary Contact
    // ------------------------------------------------
    const primaryContacts = contacts.filter(
      contact => contact.is_primary === true
    ).length;

    if (primaryContacts > 1) {
      return res.status(400).json({
        success: false,
        message: "Only one contact can be marked as primary."
      });
    }

    // ------------------------------------------------
    // Validate Duplicate Emails in Request
    // ------------------------------------------------
    const emailsInRequest = contacts
      .map(contact => contact.email?.trim().toLowerCase())
      .filter(Boolean);

    const uniqueEmails = new Set(emailsInRequest);

    if (uniqueEmails.size !== emailsInRequest.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate emails found in your contact list."
      });
    }

    // ------------------------------------------------
    // Check Emails Used By Other Employees
    // ------------------------------------------------
    if (emailsInRequest.length > 0) {
      const globalCheck = await client.query(
        `
        SELECT email
        FROM contact
        WHERE LOWER(email) = ANY($1)
          AND employee_id != $2
        `,
        [emailsInRequest, employee_id]
      );

      if (globalCheck.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: `The email ${globalCheck.rows[0].email} is already used by another employee.`
        });
      }
    }

    await client.query("BEGIN");

    // ------------------------------------------------
    // Delete Existing Contacts
    // ------------------------------------------------
    await client.query(
      `DELETE FROM contact WHERE employee_id = $1`,
      [employee_id]
    );

    // ------------------------------------------------
    // Insert Updated Contacts
    // ------------------------------------------------
    if (contacts.length > 0) {
      const values = [];

      const placeholders = contacts
        .map((contact, i) => {
          const offset = i * 7;

          values.push(
            employee_id,
            contact.contact_type || null,
            contact.contact_type_id || null,
            contact.phone || null,
            contact.email?.trim().toLowerCase() || null,
            contact.relation || null,
            contact.is_primary ?? false
          );

          return `(
            $${offset + 1},
            $${offset + 2},
            $${offset + 3},
            $${offset + 4},
            $${offset + 5},
            $${offset + 6},
            $${offset + 7},
            NOW()
          )`;
        })
        .join(",");

      await client.query(
        `
        INSERT INTO contact (
          employee_id,
          contact_type,
          contact_type_id,
          phone,
          email,
          relation,
          is_primary,
          created_at
        )
        VALUES ${placeholders}
        `,
        values
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Contacts updated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Bulk Contact Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });

  } finally {
    client.release();
  }
};

exports.deleteContactInfo = async (req, res) => {
  const { employee_id, id } = req.params;

  try {
    const contactId = Number(id);

    if (isNaN(contactId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Contact ID"
      });
    }

    // ------------------------------------------------
    // Check Contact
    // ------------------------------------------------
    const result = await db.query(
      `
      SELECT
        id,
        is_primary
      FROM contact
      WHERE id = $1
        AND employee_id = $2
      `,
      [contactId, employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Contact not found for this employee."
      });
    }

    const isPrimary = result.rows[0].is_primary;

    // ------------------------------------------------
    // If Primary, don't allow deleting when others exist
    // ------------------------------------------------
    if (isPrimary) {
      const countResult = await db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM contact
        WHERE employee_id = $1
        `,
        [employee_id]
      );

      const totalContacts = countResult.rows[0].total;

      if (totalContacts > 1) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot delete the Primary contact. Assign another contact as Primary first."
        });
      }
    }

    // ------------------------------------------------
    // Delete Contact
    // ------------------------------------------------
    const deleteResult = await db.query(
      `
      DELETE FROM contact
      WHERE id = $1
        AND employee_id = $2
      RETURNING *
      `,
      [contactId, employee_id]
    );

    return res.status(200).json({
      success: true,
      message: "Contact deleted successfully.",
      deletedContact: deleteResult.rows[0]
    });

  } catch (error) {
    console.error("Delete Contact Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during deletion."
    });
  }
};


exports.getNomineeInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    // console.log("getNominee:", emp_id);

    //  Ensure integer (important if column type integer hai)
    const empIdInt = parseInt(employee_id);

    const query = `
      SELECT *
      FROM nominee
      WHERE employee_id = $1
      
    `;

    const result = await db.query(query, [empIdInt]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        nominee: null
      });
    }

    // console.log("Get Nominee",result.rows[0]);

    res.status(200).json({
      success: true,
      nominee: result.rows
    });

  } catch (error) {
    console.error("Get Nominee Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// exports.addNomineeInfo = async (req, res) => {
//   try {
//     const { nominee_name, nominee_relation, nominee_contact } = req.body;
//     const { emp_id } = req.params;

//     const empId = emp_id ? emp_id : req.user.emp_id;

//     // console.log("empId:", empId);
//     // console.log("Body:", req.body);

//     //  Validate input
//     if (!nominee_name || !nominee_relation || !nominee_contact) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields are required",
//       });
//     }

//     const query = `
//       INSERT INTO nominee 
//       (emp_id, nominee_name, nominee_relation, nominee_contact)
//       VALUES ($1, $2, $3, $4)
//       RETURNING *
//     `;

//     const result = await db.query(query, [
//       empId,
//       nominee_name,
//       nominee_relation,
//       nominee_contact,
//     ]);

//     return res.status(200).json({
//       success: true,
//       message: "Nominee added successfully",
//       data: result.rows[0],
//     });

//   } catch (error) {
//     console.error("Add Nominee Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };
exports.addNomineeInfo = async (req, res) => {
  try {
    const { nominees } = req.body;
    const { employee_id } = req.params;
    const empId = employee_id || req.user.emp_id;

    // 1. Basic Validation
    // if (!nominees || !Array.isArray(nominees) || nominees.length === 0) {
    //   return res.status(400).json({ success: false, message: "Nominees array is required" });
    // }

    // 2. Fetch Existing Total Percentage from DB
    const percentageCheck = await db.query(
      `SELECT SUM(nominee_percentage) as total_pct FROM nominee WHERE employee_id = $1`,
      [empId]
    );
    const existingTotal = Number(percentageCheck.rows[0].total_pct || 0);

    if (existingTotal >= 100) {
      return res.status(400).json({
        success: false,
        message: `Total percentage is already 100%. Cannot add more nominees.`,
      });
    }

    // 3. Validate Each New Nominee & Calculate Incoming Total
    let incomingTotal = 0;
    // for (const nominee of nominees) {
    //   const { nominee_name, nominee_relation, nominee_contact, nominee_percentage } = nominee;

    //   if (!nominee_name || !nominee_relation || !nominee_contact || nominee_percentage === undefined) {
    //     return res.status(400).json({ success: false, message: "All nominee fields are required" });
    //   }

    //   if (!/^[0-9]{10}$/.test(nominee_contact.toString())) {
    //     return res.status(400).json({ success: false, message: "Contact number must be 10 digits" });
    //   }

    //   const pct = Number(nominee_percentage);
    //   if (pct <= 0 || pct > 100) {
    //     return res.status(400).json({ success: false, message: "Percentage must be between 1 and 100" });
    //   }
    //   incomingTotal += pct;
    // }

    // 4. Final Percentage Cap Check
    if (existingTotal + incomingTotal > 100) {
      return res.status(400).json({
        success: false,
        message: `Remaining allowed: ${100 - existingTotal}%`,
      });
    }

    // 5. Duplicate Contact Check
    const contacts = nominees.map(n => n.nominee_contact.toString());
    const existingContact = await db.query(
      `SELECT nominee_contact FROM nominee WHERE employee_id = $1 AND nominee_contact = ANY($2)`,
      [empId, contacts]
    );

    if (existingContact.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Nominee with this contact already exists" });
    }

    // 6. Bulk Insert
    const values = [];
    const placeholders = nominees.map((nominee, index) => {
      const base = index * 5;
      values.push(empId, nominee.nominee_name, nominee.nominee_relation, nominee.nominee_contact.toString(), nominee.nominee_percentage);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    const query = `
      INSERT INTO nominee (employee_id, nominee_name, nominee_relation, nominee_contact, nominee_percentage)
      VALUES ${placeholders.join(", ")} RETURNING *`;

    const result = await db.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Nominees added successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Add Nominee Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
// exports.updateNomineeInfo = async (req, res) => {
//   try {
//     const { nominee_name, nominee_relation, nominee_contact } = req.body;
//     const emp_id = req.user.emp_id;

//     if (!nominee_name || !nominee_relation || !nominee_contact) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     const query = `
//       UPDATE nominee
//       SET 
//         nominee_name = $1,
//         nominee_relation = $2,
//         nominee_contact = $3
//       WHERE emp_id = $4
//       RETURNING *;
//     `;

//     const result = await db.query(query, [
//       nominee_name,
//       nominee_relation,
//       nominee_contact,
//       emp_id
//     ]);

//     if (result.rowCount === 0) {
//       return res.status(404).json({ message: "Nominee not found for this employee" });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Nominee info updated successfully",
//       data: result.rows[0]
//     });

//   } catch (error) {
//     console.error("Update Nominee Error:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };
exports.updateNomineeInfo = async (req, res) => {
  try {
    const { id } = req.params; 
    const { nominee_name, nominee_relation, nominee_contact, nominee_percentage } = req.body;
    const emp_id = req.user.emp_id;
    const newPercentage = Number(nominee_percentage);

    // 1. Basic Validation
    // if (!nominee_name || !nominee_relation || !nominee_contact || nominee_percentage === undefined) {
    //   return res.status(400).json({ success: false, message: "All fields are required" });
    // }

    // 2. Contact Validation (10 digits)
    const contactStr = nominee_contact.toString();
    if (!/^[0-9]{10}$/.test(contactStr)) {
      return res.status(400).json({ success: false, message: "Contact number must be exactly 10 digits" });
    }

    // 3. Percentage Calculation Logic
    // We fetch all nominees for this employee EXCEPT the one we are currently updating
    const otherNominees = await db.query(
      `SELECT nominee_percentage FROM nominee WHERE employee_id = $1 AND id != $2`,
      [employee_id, id]
    );

    const existingTotal = otherNominees.rows.reduce(
      (sum, n) => sum + Number(n.nominee_percentage),
      0
    );

    const projectedTotal = existingTotal + newPercentage;

    if (projectedTotal > 100) {
      return res.status(400).json({
        success: false,
        message: `You only have ${100 - existingTotal}% remaining.`,
      });
    }

    // 4. Perform Update
    const query = `
      UPDATE nominee
      SET 
        nominee_name = $1,
        nominee_relation = $2,
        nominee_contact = $3,
        nominee_percentage = $4
      WHERE id = $5 AND employee_id = $6
      RETURNING *;
    `;

    const result = await db.query(query, [
      nominee_name,
      nominee_relation,
      contactStr, // Stored as string to avoid "Integer out of range"
      newPercentage,
      id,
      employee_id
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Nominee not found or not authorized",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Nominee updated successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Update Nominee Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


exports.deleteNomineeInfo = async (req, res) => {
  try {

    console.log("req.params",req.params);

    const {employee_id,id } = req.params; 
    // const emp_id = req.user.emp_id; 

    console.log("Delete id",id);
    console.log("Delete employee_id",employee_id);

    const query = `
      DELETE FROM nominee
      WHERE id = $1 AND employee_id = $2
      RETURNING *;
    `;

    const result = await db.query(query, [id, employee_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Nominee not found or not authorized" });
    }

    res.status(200).json({
      message: "Nominee deleted successfully",
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error("Delete Nominee Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.addBankInfo = async (req, res) => {
  try {
    const {employee_id } = req.params;
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
      account_type_id
    } = req.body;

    // console.log(req.body);


    // if (!account_holder_name || !bank_name || !account_number || !ifsc_code || !branch_name) {
    //   return res.status(400).json({ message: "All required fields must be provided." });
    // }

    const result = await db.query(
      `
      INSERT INTO bank_accounts (
        employee_id, account_holder_name, bank_name, account_number, ifsc_code, branch_name, upi_id, account_type, pan_number, account_type_id, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        employee_id,
        account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        branch_name,
        upi_id,
        account_type,
        pan_number,
        account_type_id,
        is_active
      ]
    );

    // console.log("result.rows[0]",result.rows[0])
    // sendNotification(emp_id, "Bank", req.user.name);
    res.status(201).json({
      message: "Bank details saved successfully",
      bankInfo: result.rows[0],
    });
  } catch (error) {
    console.error("Bank save error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

exports.getBankInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const result = await db.query(
      `SELECT * FROM bank_accounts WHERE employee_id = $1`,
      [employee_id]
    );

    res.status(200).json({
      bankDetails: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

exports.updateBankInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    // console.log("req.body bank update ",req.body);
    const {
      account_holder_name,
      bank_name,
      account_number,
      ifsc_code,
      branch_name,
      upi_id,
      account_type,
      pan_number,
      account_type_id,
      is_active
    } = req.body;

    // if (
    //   !account_holder_name ||
    //   !bank_name ||
    //   !account_number ||
    //   !ifsc_code ||
    //   !account_type ||
    //   !pan_number
    // ) {
    //   return res.status(400).json({
    //     message: "Required bank fields are missing"
    //   });
    // }


const recordCheck = await db.query(
      `SELECT id FROM bank_accounts WHERE employee_id = $1`, 
      [employee_id]
    ); 

    if (recordCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No bank details found for this employee. Use the 'Add' feature instead of 'Update'."
      });
    }

    // Basic validation
    

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
        account_type_id = $10,
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
        account_type_id || null,
        employee_id
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

    // sendNotification(emp_id, "Bank", req.user.name);

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
}


// exports.addBankDocInfo = async (req, res) => {
//   try {
//     const { emp_id } = req.params;
    
//     const {documentType,documentNumber} = req.body;


//     console.log("documentType,documentNumber",documentType,documentNumber)

//     if (!req.files || Object.keys(req.files).length === 0) {
//       return res.status(400).json({ message: "No files uploaded" });
//     }

//     const uploadedDocs = [];

//     for (const field in req.files) {
//       const file = req.files[field][0];

//       // 1. Get the old file path BEFORE updating the DB
//       const { rows: existing } = await db.query(
//         "SELECT file_path FROM bank_documents WHERE emp_id = $1 AND file_type = $2",
//         [emp_id, file.fieldname]
//       );

//       // 2. Perform the Upsert (Insert or Update)
//       const result = await db.query(
//         `
//         INSERT INTO bank_documents (
//           bank_account_id, 
//           file_type, 
//           file_name, 
//           file_path, 
//           file_size, 
//           created_at, 
//           updated_at
//         )
//         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
//         ON CONFLICT (bank_account_id, file_type) 
//         DO UPDATE SET 
//           file_name = EXCLUDED.file_name,
//           file_path = EXCLUDED.file_path,
//           file_size = EXCLUDED.file_size,
//           updated_at = NOW()
//         RETURNING *;
//         `,
//         [
//           emp_id,
//           file.fieldname,
//           file.originalname,
//           `/uploads/bank-docs/${file.filename}`,
//           file.size,
//         ]
//       );

//       // 3. Delete the old physical file from disk ONLY IF the DB update succeeded
//       if (existing.length > 0 && existing[0].file_path) {
//         // Adjust path resolution based on your folder structure
//         const oldFilePath = path.join(__dirname, "../../", existing[0].file_path);

//         if (fs.existsSync(oldFilePath)) {
//           fs.unlink(oldFilePath, (err) => {
//             if (err) console.error("Could not delete old file:", err);
//           });
//         }
//       }

//       uploadedDocs.push(result.rows[0]);
//     }

//     // sendNotification(emp_id, "Bank Documents", req.user?.name || "Employee");

//     return res.status(201).json({
//       message: "Bank documents uploaded successfully",
//       documents: uploadedDocs,
//     });

//   } catch (error) {
//     console.error("Database Error details:", error.hint || error.message);
//     if (!res.headersSent) {
//       res.status(500).json({
//         message: "Internal Server Error",
//         error: error.message
//       });
//     }
//   }
// }
exports.addBankDocInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { documentType, documentNumber, documentTypeId } = req.body;
    const file = req.file;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "employee_id is required"
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Use form-data field 'document'."
      });
    }

    if (!documentType) {
      return res.status(400).json({
        success: false,
        message: "documentType is required"
      });
    }

    if (!documentTypeId) {
      return res.status(400).json({
        success: false,
        message: "documentTypeId is required"
      });
    }

    const existingResult = await db.query(
      `
      SELECT file_path
      FROM bank_documents
      WHERE employee_id = $1
        AND document_type_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [employee_id, documentTypeId]
    );

    const existing = existingResult.rows;

    const filePath = `/uploads/bank-docs/${file.filename}`;

    const result = await db.query(
      `
      INSERT INTO bank_documents (
        employee_id,
        document_type,
        document_number,
        document_type_id,
        file_name,
        file_path,
        file_size,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *;
      `,
      [
        employee_id,
        documentType,
        documentNumber || null,
        documentTypeId,
        file.originalname,
        filePath,
        file.size
      ]
    );

    if (existing.length > 0 && existing[0].file_path) {
      const oldFilePath = path.join(
        __dirname,
        "..",
        existing[0].file_path
      );

      if (fs.existsSync(oldFilePath)) {
        fs.unlink(oldFilePath, (err) => {
          if (err) {
            console.error("Could not delete old file:", err);
          } else {
            console.log("Old file deleted:", oldFilePath);
          }
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Bank document saved successfully",
      document: result.rows[0]
    });
  } catch (error) {
    console.error("Add Bank Document Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.deleteDocument = async (req, res) => {
  try {
    const { id, employee_id } = req.params;

    const queryDelete = `
      DELETE FROM bank_documents
      WHERE id = $1 AND employee_id = $2
    `;

    const result = await db.query(queryDelete, [id, employee_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.status(200).json({ message: "Doc Deleted Successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

exports.getAllBankDoc = async (req, res) => {
  try {
    const { employee_id } = req.params;

    // Fetch documents from DB
    const result = await db.query(
      `
      SELECT id,employee_id, document_type,document_number, documentTypeId, file_name, file_path, file_size, created_at, updated_at
      FROM bank_documents
      WHERE employee_id = $1
      ORDER BY created_at ASC
      `,
      [employee_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No documents found" });
    }

    res.status(200).json({
      employee_id,
      documents: result.rows,
    });
  } catch (error) {
    console.error("Bank Documents GET Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

exports.addProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const requestedEmpId = req.params.emp_id;   
    const loggedInEmpId = req.user.emp_id;    
    const userRole = req.user.role;

   
    if (userRole !== "admin" && requestedEmpId !== loggedInEmpId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const imagePath = `/uploads/profile-images/${req.file.filename}`;

    // Get old image
    const oldImageResult = await db.query(
      `SELECT profile_image FROM users WHERE emp_id = $1`,
      [requestedEmpId]
    );

    const oldImagePath = oldImageResult.rows[0]?.profile_image;

    // Delete old image
    if (oldImagePath) {
      const fullPath = path.join(__dirname, "..", oldImagePath);

      if (fs.existsSync(fullPath)) {
        fs.unlink(fullPath, (err) => {
          if (err) console.error("Failed to delete old profile image:", err);
        });
      }
    }

    // Update DB
    await db.query(
      `UPDATE users SET profile_image = $1 WHERE emp_id = $2`,
      [imagePath, requestedEmpId]
    );

    res.status(200).json({
      message: oldImagePath
        ? "Profile image updated successfully"
        : "Profile image added successfully",
      profile_image: imagePath,
    });

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getProfileImage = async (req, res) => {
  try {
    const requestedEmpId = req.params.emp_id;   
    const loggedInEmpId = req.user.emp_id;    
    const userRole = req.user.role;

    // If normal employee → only allow own image
    if (userRole !== "admin" && requestedEmpId !== loggedInEmpId) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const result = await db.query(
      `SELECT profile_image FROM users WHERE emp_id = $1`,
      [requestedEmpId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileImage = result.rows[0].profile_image;

    let formattedPath = profileImage;
    if (profileImage && !profileImage.startsWith("/")) {
      formattedPath = `/${profileImage}`;
    }

    const fullImageUrl = profileImage
      ? `${req.protocol}://${req.get("host")}${formattedPath}`
      : null;

    res.status(200).json({
      profile_image: fullImageUrl,
    });

  } catch (error) {
    console.error("Fetch profile image error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.addAddressInfo = async (req, res) => {
  try {
    const {
      employee_id,
      permanent_address,
      current_address
    } = req.body;

    console.log("Address Body:", req.body);
    console.log("employee_id:", employee_id);

    if (employee_id == null || employee_id === undefined) {
      return res.status(400).json({
        success: false,
        message: "employee_id required"
      });
    }

    const query = `
      INSERT INTO address (
        employee_id,
        permanent_address,
        current_address
      )
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const result = await db.query(query, [
      employee_id,
      permanent_address,
      current_address
    ]);

    return res.status(201).json({
      success: true,
      message: "Address info added successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("[ERROR] /address POST:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.updateAddressInfo = async (req, res) => {
  try {
    const { employee_id, permanent_address, current_address} = req.body;

    // console.log("Education",req.body);
    
    // console.log("emp_id Add Education", emp_id)

    if(!employee_id){
      return res.status(400).json({message:"employee_id required"});
    }


    // console.log("req.user.emp_id,emp_id",req.user.emp_id,emp_id)

    // if (req.user.role === "employee" && req.user.emp_id !== emp_id) {
    //   return res.status(403).json({ message: "Unauthorized" });
    // }

    const query = `Update address set permanent_address=$1,current_address=$2 where employee_id=$3`;
    await db.query(query, [permanent_address, current_address, employee_id]);

    res.status(201).json({
      message: "Address info updated successfully",
      address: { permanent_address, current_address },
    });

  } catch (error) {
    console.error("[ERROR] /address PUT:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.getAddressInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    if(!employee_id){
      return res.status(400).json({message:"employee_id required"});
    }

    const result = await db.query(
      `SELECT permanent_address, current_address FROM address WHERE employee_id = $1`,
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Address info not found" });
    }

    res.status(200).json({
      address: result.rows[0],
    });
  } catch (error) {
    console.error("[ERROR] /address GET:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
