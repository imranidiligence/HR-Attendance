const fs = require("fs");
const multer = require("multer");
const path = require("path");
const auth = require("../middlewares/authMiddleware");
const { db } = require("../db/connectDB");
const sendEmail = require("../utils/mailer");
const sendNotification = require("../services/notification.services");

// ---------- Helper to get Pr_Id from Or_Emp_Id ----------
const getPrIdByEmployeeId = async (orEmpId) => {
  if (!orEmpId) return null;
  const result = await db.query(
    `SELECT pr_id FROM organizations WHERE or_emp_id = $1`,
    [orEmpId]
  );
  return result.rows.length ? result.rows[0].pr_id : null;
};

// ============================================================
//   ORGANIZATION CONTROLLERS
// ============================================================

exports.addOrganizationInfo = async (req, res) => {
  const { employee_id } = req.params; // Or_Emp_Id
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

    await client.query("BEGIN");

    // Get Pr_Id from personal (must already exist)
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Personal record not found for this employee code"
      });
    }

    const isActive = leaving_date ? false : true;

    // Insert into organizations (Or_Id auto-generated)
    const orgResult = await client.query(
      `
      INSERT INTO organizations (
        or_emp_id,
        pr_id,
        organization_name,
        organization_code,
        industry_type,
        organization_location,
        city,
        state,
        country,
        is_active,
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
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
      `,
      [
        employee_id,
        prId,
        organization_name,
        organization_code,
        industry_type,
        organization_location,
        city,
        state,
        country,
        isActive,
        employee_type_id,
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

    // Also update the active status in personal if needed
    await client.query(
      `UPDATE personal SET pr_is_active = $1 WHERE pr_id = $2`,
      [isActive, prId]
    );

    // (Optional) Insert into employee_reporting if that table exists
    // ...

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Organization information added successfully",
      organizationData: orgResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Organization POST error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.getOrganizationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params; // Or_Emp_Id

    const orgResult = await db.query(
      `
      SELECT
        or_id,
        or_emp_id,
        pr_id,
        organization_name,
        organization_code,
        industry_type,
        organization_location,
        city,
        state,
        country,
        is_active,
        created_at,
        updated_at,
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
      FROM organizations
      WHERE or_emp_id = $1
      `,
      [employee_id]
    );

    if (!orgResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Organization information not found"
      });
    }

    // Optionally fetch reporting data
    // ...

    return res.status(200).json({
      success: true,
      organizationData: orgResult.rows[0]
    });

  } catch (error) {
    console.error("Get Organization Info error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrganizationInfo = async (req, res) => {
  const { employee_id } = req.params; // Or_Emp_Id
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

    await client.query("BEGIN");

    // Get Pr_Id to update personal if needed
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Personal record not found"
      });
    }

    const isActive = leaving_date ? false : true;

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
        reporting_location_id = $10,
        organization_email = $11,
        department_id = $12,
        designation_id = $13,
        joining_date = $14,
        leaving_date = $15,
        official_email_id = $16,
        official_contact_no = $17,
        reporting_to_id = $18,
        employeeidoforganisation = $19,
        updated_at = NOW()
      WHERE or_emp_id = $20
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
        message: "Organization not found"
      });
    }

    // Update personal active status
    await client.query(
      `UPDATE personal SET pr_is_active = $1, pr_updated_at = NOW() WHERE pr_id = $2`,
      [isActive, prId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully",
      organizationData: orgResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Organization Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================================
//   PERSONAL CONTROLLERS
// ============================================================

const parseDob = (dob) => {
  if (!dob) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
    const [day, month, year] = dob.split("-");
    return `${year}-${month}-${day}`;
  }
  throw new Error("Invalid DOB format");
};

exports.addPersonInfo = async (req, res) => {
  const { employee_id } = req.params; // Or_Emp_Id
  const client = await db.connect();

  try {
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

    // Check if Or_Emp_Id already exists in organizations
    const existingOrg = await client.query(
      `SELECT pr_id FROM organizations WHERE or_emp_id = $1`,
      [employee_id]
    );
    if (existingOrg.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Employee code already exists"
      });
    }

    const formattedDob = parseDob(dob);
    const formattedJoining = parseDate(joining_date);
    const formattedLeaving = parseDate(leaving_date);

    // Insert into personal (Pr_Id auto-generated)
    const personalResult = await client.query(
      `
      INSERT INTO personal (
        pr_email,
        pr_first_name,
        pr_last_name,
        pr_dob,
        pr_gender_id,
        pr_blood_group_id,
        pr_marital_status_id,
        pr_nationality_id,
        pr_is_active,
        pr_created_at,
        pr_updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING pr_id
      `,
      [
        email,
        first_name,
        last_name,
        formattedDob,
        gender_id || null,
        blood_group_id || null,
        marital_status_id || null,
        nationality_id || null,
        true // default active
      ]
    );

    const prId = personalResult.rows[0].pr_id;

    // Insert into organizations with the Or_Emp_Id
    await client.query(
      `
      INSERT INTO organizations (
        or_emp_id,
        pr_id,
        is_active,
        joining_date,
        leaving_date,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `,
      [
        employee_id,
        prId,
        leaving_date ? false : true,
        formattedJoining,
        formattedLeaving
      ]
    );

    // Optionally insert into other tables (contact, address, etc.) if provided
    // ...

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Personal details created successfully",
      pr_id: prId
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Personal POST error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.getPersonalInfo = async (req, res) => {
  try {
    const { employee_id } = req.params; // Or_Emp_Id

    const result = await db.query(
      `
      SELECT
        p.pr_id,
        p.pr_email,
        p.pr_first_name,
        p.pr_last_name,
        p.pr_dob,
        p.pr_gender_id,
        p.pr_blood_group_id,
        p.pr_marital_status_id,
        p.pr_nationality_id,
        p.pr_is_active,
        p.pr_profile_image,
        p.pr_created_at,
        p.pr_updated_at,
        o.or_emp_id,
        o.organization_name,
        o.department_id,
        o.designation_id,
        o.joining_date,
        o.leaving_date,
        o.employee_type_id,
        o.reporting_location_id,
        o.official_email_id,
        o.official_contact_no
      FROM personal p
      JOIN organizations o ON p.pr_id = o.pr_id
      WHERE o.or_emp_id = $1
      `,
      [employee_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Personal information not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Get Personal Info error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePersonalInfo = async (req, res) => {
  const { employee_id } = req.params; // Or_Emp_Id
  const client = await db.connect();

  try {
    const {
      first_name,
      last_name,
      email,
      contact,
      dob,
      gender_id,
      marital_status_id,
      nationality_id,
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

    // Get Pr_Id
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const formattedDob = parseDob(dob);
    const formattedJoining = parseDate(joining_date);
    const formattedLeaving = parseDate(leaving_date);
    const isActive = formattedLeaving ? false : true;

    await client.query("BEGIN");

    // Update personal
    await client.query(
      `
      UPDATE personal
      SET
        pr_first_name = $1,
        pr_last_name = $2,
        pr_email = $3,
        pr_dob = $4,
        pr_gender_id = $5,
        pr_blood_group_id = $6,
        pr_marital_status_id = $7,
        pr_nationality_id = $8,
        pr_is_active = $9,
        pr_updated_at = NOW()
      WHERE pr_id = $10
      `,
      [
        first_name,
        last_name,
        email,
        formattedDob,
        gender_id || null,
        blood_group_id || null,
        marital_status_id || null,
        nationality_id || null,
        isActive,
        prId
      ]
    );

    // Update organizations (for employee code and other org fields)
    await client.query(
      `
      UPDATE organizations
      SET
        is_active = $1,
        joining_date = $2,
        leaving_date = $3,
        department_id = $4,
        designation_id = $5,
        employee_type_id = $6,
        reporting_location_id = $7,
        updated_at = NOW()
      WHERE pr_id = $8
      `,
      [
        isActive,
        formattedJoining,
        formattedLeaving,
        department || null,
        designation || null,
        employee_type || null,
        reporting_location || null,
        prId
      ]
    );

    // If contact, address, etc. are included, update those tables here as well

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Personal information updated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Personal Info error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================================
//   EDUCATION CONTROLLERS
// ============================================================

exports.addEducationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params; // Or_Emp_Id

    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ message: "Employee not found" });
    }

    let educationArray = [];
    if (typeof req.body.education === 'string') {
      educationArray = JSON.parse(req.body.education);
    } else if (Array.isArray(req.body.education)) {
      educationArray = req.body.education;
    } else if (Array.isArray(req.body)) {
      educationArray = req.body;
    } else if (typeof req.body === "object") {
      educationArray = [req.body];
    }

    if (!educationArray.length) {
      return res.status(400).json({ message: "Education data is required" });
    }

    const inserted = [];
    for (const edu of educationArray) {
      const {
        field_of_study,
        institution_name,
        university,
        passing_year,
        percentage_or_grade,
        degree_id
      } = edu;

      const { rows } = await db.query(
        `
        INSERT INTO education (
          pr_id,
          ed_field_of_study,
          ed_institution_name,
          ed_university,
          ed_passing_year,
          ed_percentage_or_grade,
          ed_degree_id,
          ed_created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
        `,
        [
          prId,
          field_of_study || null,
          institution_name || null,
          university || null,
          passing_year || null,
          percentage_or_grade || null,
          degree_id || null
        ]
      );
      inserted.push(rows[0]);
    }

    res.status(201).json({
      success: true,
      message: "Education added successfully",
      education: inserted
    });

  } catch (error) {
    console.error("Education POST error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEducationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params; // Or_Emp_Id

    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { rows } = await db.query(
      `
      SELECT
        ed_id,
        pr_id,
        ed_degree_id,
        ed_field_of_study,
        ed_institution_name,
        ed_university,
        ed_percentage_or_grade,
        ed_passing_year,
        ed_created_at,
        ed_updated_at
      FROM education
      WHERE pr_id = $1
      ORDER BY ed_passing_year DESC NULLS LAST, ed_id DESC
      `,
      [prId]
    );

    res.status(200).json({
      success: true,
      total: rows.length,
      education: rows
    });

  } catch (error) {
    console.error("Get Education error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEducationInfo = async (req, res) => {
  const client = await db.connect();
  try {
    const { employee_id } = req.params; // Or_Emp_Id

    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Employee not found" });
    }

    let educationEntries;
    try {
      educationEntries = JSON.parse(req.body.education);
    } catch {
      return res.status(400).json({ message: "Invalid JSON format" });
    }
    if (!Array.isArray(educationEntries)) {
      return res.status(400).json({ message: "Education must be an array" });
    }

    await client.query("BEGIN");

    for (let i = 0; i < educationEntries.length; i++) {
      const edu = educationEntries[i];
      // Handle file upload if needed (not shown here)
      const finalPath = edu.marksheet_url || null;

      if (edu.ed_id) {
        // Update existing
        const updateResult = await client.query(
          `
          UPDATE education
          SET
            ed_degree_id = $1,
            ed_field_of_study = $2,
            ed_institution_name = $3,
            ed_university = $4,
            ed_percentage_or_grade = $5,
            ed_passing_year = $6,
            ed_updated_at = NOW()
          WHERE ed_id = $7 AND pr_id = $8
          RETURNING *
          `,
          [
            edu.degree_id || null,
            edu.field_of_study || null,
            edu.institution_name || null,
            edu.university || null,
            edu.percentage_or_grade || null,
            edu.passing_year || null,
            edu.ed_id,
            prId
          ]
        );
        if (updateResult.rowCount === 0) {
          throw new Error(`Education record ${edu.ed_id} not found`);
        }
      } else {
        // Insert new
        await client.query(
          `
          INSERT INTO education (
            pr_id,
            ed_degree_id,
            ed_field_of_study,
            ed_institution_name,
            ed_university,
            ed_percentage_or_grade,
            ed_passing_year,
            ed_created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `,
          [
            prId,
            edu.degree_id || null,
            edu.field_of_study || null,
            edu.institution_name || null,
            edu.university || null,
            edu.percentage_or_grade || null,
            edu.passing_year || null
          ]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(200).json({ success: true, message: "Education updated" });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Education error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.deleteEducationInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params; // Or_Emp_Id and education id
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const result = await db.query(
      `DELETE FROM education WHERE ed_id = $1 AND pr_id = $2 RETURNING ed_id`,
      [id, prId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    res.status(200).json({ success: true, message: "Education deleted" });

  } catch (error) {
    console.error("Delete Education error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   EXPERIENCE CONTROLLERS
// ============================================================

exports.addExperienceInfo = async (req, res) => {
  try {
    const { employee_id } = req.params; // Or_Emp_Id
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const {
      company_name,
      designation,
      start_date,
      end_date,
      total_years,
      location,
      designation_id
    } = req.body;

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    if (end < start) {
      return res.status(400).json({ message: "End date cannot be before start date" });
    }

    const result = await db.query(
      `
      INSERT INTO experience (
        pr_id,
        ex_company_name,
        ex_designation_id,
        ex_start_date,
        ex_end_date,
        ex_total_years,
        ex_location,
        ex_created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
      `,
      [
        prId,
        company_name.trim(),
        designation_id || null,
        start_date,
        end_date,
        total_years || null,
        location.trim()
      ]
    );

    res.status(201).json({
      success: true,
      message: "Experience created",
      experience: result.rows[0]
    });

  } catch (error) {
    console.error("Add Experience error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExperienceInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const { rows } = await db.query(
      `
      SELECT
        ex_id,
        pr_id,
        ex_company_name,
        ex_designation_id,
        ex_start_date,
        ex_end_date,
        ex_total_years,
        ex_location
      FROM experience
      WHERE pr_id = $1
      ORDER BY ex_start_date DESC NULLS LAST
      `,
      [prId]
    );

    res.status(200).json({
      success: true,
      total: rows.length,
      experience: rows
    });

  } catch (error) {
    console.error("Get Experience error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateExperienceInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const {
      company_name,
      designation_id,
      start_date,
      end_date,
      total_years,
      location
    } = req.body;

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    if (end < start) {
      return res.status(400).json({ message: "End date cannot be before start date" });
    }

    const result = await db.query(
      `
      UPDATE experience
      SET
        ex_company_name = $1,
        ex_designation_id = $2,
        ex_start_date = $3,
        ex_end_date = $4,
        ex_total_years = $5,
        ex_location = $6,
        ex_updated_at = NOW()
      WHERE ex_id = $7 AND pr_id = $8
      RETURNING *
      `,
      [
        company_name.trim(),
        designation_id || null,
        start_date,
        end_date,
        total_years || null,
        location.trim(),
        id,
        prId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Experience not found" });
    }

    res.status(200).json({
      success: true,
      message: "Experience updated",
      experience: result.rows[0]
    });

  } catch (error) {
    console.error("Update Experience error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteExperienceInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const result = await db.query(
      `DELETE FROM experience WHERE ex_id = $1 AND pr_id = $2 RETURNING ex_id`,
      [id, prId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Experience not found" });
    }

    res.status(200).json({ success: true, message: "Experience deleted" });

  } catch (error) {
    console.error("Delete Experience error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   CONTACT CONTROLLERS
// ============================================================

exports.getContactInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `
      SELECT
        ct_id,
        pr_id,
        ct_contact_type_id,
        ct_phone,
        ct_email,
        ct_relation,
        ct_is_primary,
        ct_created_at
      FROM contact
      WHERE pr_id = $1
      ORDER BY ct_is_primary DESC, ct_id ASC
      `,
      [prId]
    );

    res.status(200).json({
      success: true,
      total: result.rows.length,
      contacts: result.rows
    });

  } catch (error) {
    console.error("Get Contact error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addContactInfo = async (req, res) => {
  const { employee_id } = req.params;
  const newContact = req.body;
  const client = await db.connect();

  try {
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    await client.query("BEGIN");

    // Get existing contacts for this pr_id
    const existing = await client.query(
      `SELECT ct_phone, ct_email, ct_is_primary FROM contact WHERE pr_id = $1`,
      [prId]
    );

    const incomingContacts = Array.isArray(newContact) ? newContact : [newContact];
    const updatedList = [...existing.rows, ...incomingContacts];

    // Validate only one primary
    const primaryCount = updatedList.filter(c => c.ct_is_primary === true).length;
    if (primaryCount > 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Only one primary contact allowed" });
    }

    // Validate duplicate emails
    const emails = updatedList.map(c => c.ct_email?.trim().toLowerCase()).filter(Boolean);
    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Duplicate emails found" });
    }

    // Delete all existing contacts for this pr_id
    await client.query(`DELETE FROM contact WHERE pr_id = $1`, [prId]);

    // Insert new contacts (ct_id auto-generated)
    if (updatedList.length > 0) {
      const values = [];
      const placeholders = updatedList.map((contact, i) => {
        const offset = i * 7;
        values.push(
          prId,
          contact.ct_contact_type_id || null,
          contact.ct_phone || null,
          contact.ct_email?.trim().toLowerCase() || null,
          contact.ct_relation || null,
          contact.ct_is_primary ?? false
        );
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, NOW())`;
      }).join(",");

      await client.query(
        `
        INSERT INTO contact (pr_id, ct_contact_type_id, ct_phone, ct_email, ct_relation, ct_is_primary, ct_created_at)
        VALUES ${placeholders}
        `,
        values
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Contacts updated" });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Add Contact error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.updateContactInfo = async (req, res) => {
  // Similar to addContactInfo but with PUT semantics – we can reuse the same logic
  // For simplicity, we call addContactInfo but you can implement separately.
  // Here we implement as a full replace.
  const { employee_id } = req.params;
  const contacts = req.body;
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ success: false, message: "Expected an array" });
  }

  const client = await db.connect();
  try {
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    await client.query("BEGIN");

    // Delete all existing
    await client.query(`DELETE FROM contact WHERE pr_id = $1`, [prId]);

    // Insert new contacts
    if (contacts.length > 0) {
      // Validate primary and duplicates (similar as above)
      const primaryCount = contacts.filter(c => c.is_primary === true).length;
      if (primaryCount > 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Only one primary contact allowed" });
      }
      const emails = contacts.map(c => c.email?.trim().toLowerCase()).filter(Boolean);
      if (new Set(emails).size !== emails.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Duplicate emails" });
      }

      const values = [];
      const placeholders = contacts.map((contact, i) => {
        const offset = i * 7;
        values.push(
          prId,
          contact.contact_type_id || null,
          contact.phone || null,
          contact.email?.trim().toLowerCase() || null,
          contact.relation || null,
          contact.is_primary ?? false
        );
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, NOW())`;
      }).join(",");

      await client.query(
        `
        INSERT INTO contact (pr_id, ct_contact_type_id, ct_phone, ct_email, ct_relation, ct_is_primary, ct_created_at)
        VALUES ${placeholders}
        `,
        values
      );
    }

    await client.query("COMMIT");
    res.status(200).json({ success: true, message: "Contacts updated" });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Contact error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

exports.deleteContactInfo = async (req, res) => {
  const { employee_id, id } = req.params;
  try {
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Check if it's the only primary contact
    const contact = await db.query(
      `SELECT ct_is_primary FROM contact WHERE ct_id = $1 AND pr_id = $2`,
      [id, prId]
    );
    if (contact.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    if (contact.rows[0].ct_is_primary) {
      const count = await db.query(
        `SELECT COUNT(*)::int AS total FROM contact WHERE pr_id = $1`,
        [prId]
      );
      if (count.rows[0].total > 1) {
        return res.status(400).json({ success: false, message: "Cannot delete primary contact when others exist" });
      }
    }

    const result = await db.query(
      `DELETE FROM contact WHERE ct_id = $1 AND pr_id = $2 RETURNING ct_id`,
      [id, prId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    res.status(200).json({ success: true, message: "Contact deleted" });

  } catch (error) {
    console.error("Delete Contact error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   NOMINEE CONTROLLERS
// ============================================================

exports.getNomineeInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `SELECT * FROM nominee WHERE pr_id = $1`,
      [prId]
    );

    res.status(200).json({
      success: true,
      nominee: result.rows
    });

  } catch (error) {
    console.error("Get Nominee error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addNomineeInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const { nominees } = req.body;
    if (!Array.isArray(nominees) || nominees.length === 0) {
      return res.status(400).json({ success: false, message: "Nominees array required" });
    }

    // Check total percentage
    const existingTotal = await db.query(
      `SELECT COALESCE(SUM(nm_nominee_percentage), 0) as total FROM nominee WHERE pr_id = $1`,
      [prId]
    );
    let totalPct = Number(existingTotal.rows[0].total);
    let incomingTotal = 0;
    for (const nom of nominees) {
      // Validate fields
      if (!nom.nominee_name || !nom.nominee_relation || !nom.nominee_contact || nom.nominee_percentage === undefined) {
        return res.status(400).json({ success: false, message: "All fields required for each nominee" });
      }
      if (!/^\d{10}$/.test(nom.nominee_contact.toString())) {
        return res.status(400).json({ success: false, message: "Contact must be 10 digits" });
      }
      const pct = Number(nom.nominee_percentage);
      if (pct <= 0 || pct > 100) {
        return res.status(400).json({ success: false, message: "Percentage must be 1–100" });
      }
      incomingTotal += pct;
    }
    if (totalPct + incomingTotal > 100) {
      return res.status(400).json({ success: false, message: `Total exceeds 100% (remaining ${100 - totalPct}%)` });
    }

    // Check duplicate contacts
    const contacts = nominees.map(n => n.nominee_contact.toString());
    const existingContacts = await db.query(
      `SELECT nm_nominee_contact FROM nominee WHERE pr_id = $1 AND nm_nominee_contact = ANY($2)`,
      [prId, contacts]
    );
    if (existingContacts.rowCount > 0) {
      return res.status(400).json({ success: false, message: "Duplicate contact(s) found" });
    }

    // Insert nominees (nm_id auto-generated)
    const values = [];
    const placeholders = nominees.map((nom, i) => {
      const offset = i * 5;
      values.push(
        prId,
        nom.nominee_name,
        nom.nominee_relation,
        nom.nominee_contact.toString(),
        nom.nominee_percentage
      );
      return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, NOW(), NOW())`;
    }).join(",");

    const result = await db.query(
      `
      INSERT INTO nominee (pr_id, nm_nominee_name, nm_nominee_relation, nm_nominee_contact, nm_nominee_percentage, nm_created_at, nm_updated_at)
      VALUES ${placeholders}
      RETURNING *
      `,
      values
    );

    res.status(200).json({
      success: true,
      message: "Nominees added",
      data: result.rows
    });

  } catch (error) {
    console.error("Add Nominee error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateNomineeInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const { nominee_name, nominee_relation, nominee_contact, nominee_percentage } = req.body;
    // Validate fields
    if (!nominee_name || !nominee_relation || !nominee_contact || nominee_percentage === undefined) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }
    if (!/^\d{10}$/.test(nominee_contact.toString())) {
      return res.status(400).json({ success: false, message: "Contact must be 10 digits" });
    }
    const newPct = Number(nominee_percentage);
    if (newPct <= 0 || newPct > 100) {
      return res.status(400).json({ success: false, message: "Percentage must be 1–100" });
    }

    // Check other nominees' percentages
    const others = await db.query(
      `SELECT COALESCE(SUM(nm_nominee_percentage), 0) as total FROM nominee WHERE pr_id = $1 AND nm_id != $2`,
      [prId, id]
    );
    const otherTotal = Number(others.rows[0].total);
    if (otherTotal + newPct > 100) {
      return res.status(400).json({ success: false, message: `Total would exceed 100% (remaining ${100 - otherTotal}%)` });
    }

    const result = await db.query(
      `
      UPDATE nominee
      SET
        nm_nominee_name = $1,
        nm_nominee_relation = $2,
        nm_nominee_contact = $3,
        nm_nominee_percentage = $4,
        nm_updated_at = NOW()
      WHERE nm_id = $5 AND pr_id = $6
      RETURNING *
      `,
      [
        nominee_name,
        nominee_relation,
        nominee_contact.toString(),
        newPct,
        id,
        prId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Nominee not found" });
    }

    res.status(200).json({
      success: true,
      message: "Nominee updated",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Update Nominee error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteNomineeInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `DELETE FROM nominee WHERE nm_id = $1 AND pr_id = $2 RETURNING nm_id`,
      [id, prId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Nominee not found" });
    }

    res.status(200).json({ success: true, message: "Nominee deleted" });

  } catch (error) {
    console.error("Delete Nominee error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   BANK ACCOUNT CONTROLLERS
// ============================================================

exports.addBankInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

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

    const result = await db.query(
      `
      INSERT INTO bank_accounts (
        pr_id,
        ba_account_holder_name,
        ba_bank_name,
        ba_account_number,
        ba_ifsc_code,
        ba_branch_name,
        ba_upi_id,
        ba_account_type,
        ba_pan_number,
        ba_account_type_id,
        ba_is_active,
        ba_created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
      `,
      [
        prId,
        account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        branch_name || null,
        upi_id || null,
        account_type || null,
        pan_number || null,
        account_type_id || null,
        is_active
      ]
    );

    res.status(201).json({
      success: true,
      message: "Bank details saved",
      bankInfo: result.rows[0]
    });

  } catch (error) {
    console.error("Add Bank error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBankInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `SELECT * FROM bank_accounts WHERE pr_id = $1`,
      [prId]
    );

    res.status(200).json({
      success: true,
      bankDetails: result.rows
    });

  } catch (error) {
    console.error("Get Bank error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBankInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

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

    const result = await db.query(
      `
      UPDATE bank_accounts
      SET
        ba_account_holder_name = $1,
        ba_bank_name = $2,
        ba_account_number = $3,
        ba_ifsc_code = $4,
        ba_branch_name = $5,
        ba_upi_id = $6,
        ba_account_type = $7,
        ba_pan_number = $8,
        ba_account_type_id = $9,
        ba_is_active = $10,
        ba_updated_at = NOW()
      WHERE pr_id = $11
      RETURNING *
      `,
      [
        account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        branch_name || null,
        upi_id || null,
        account_type || null,
        pan_number || null,
        account_type_id || null,
        is_active ?? true,
        prId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Bank details not found" });
    }

    res.status(200).json({
      success: true,
      message: "Bank details updated",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Update Bank error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   BANK DOCUMENT CONTROLLERS
// ============================================================

exports.addBankDocInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const { documentType, documentNumber, documentTypeId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "File is required" });
    }
    if (!documentType || !documentTypeId) {
      return res.status(400).json({ success: false, message: "documentType and documentTypeId required" });
    }

    // Check existing document of same type
    const existing = await db.query(
      `SELECT file_path FROM bank_documents WHERE pr_id = $1 AND document_type_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [prId, documentTypeId]
    );

    const filePath = `/uploads/bank-docs/${file.filename}`;

    const result = await db.query(
      `
      INSERT INTO bank_documents (
        pr_id,
        document_type,
        document_number,
        document_type_id,
        file_name,
        file_path,
        file_size,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
      `,
      [
        prId,
        documentType,
        documentNumber || null,
        documentTypeId,
        file.originalname,
        filePath,
        file.size
      ]
    );

    // Delete old physical file if it existed
    if (existing.rows.length > 0 && existing.rows[0].file_path) {
      const oldPath = path.join(__dirname, "..", existing.rows[0].file_path);
      if (fs.existsSync(oldPath)) {
        fs.unlink(oldPath, (err) => {
          if (err) console.error("Could not delete old file:", err);
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Bank document saved",
      document: result.rows[0]
    });

  } catch (error) {
    console.error("Add Bank Doc error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllBankDoc = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `
      SELECT id, document_type, document_number, document_type_id, file_name, file_path, file_size, created_at, updated_at
      FROM bank_documents
      WHERE pr_id = $1
      ORDER BY created_at ASC
      `,
      [prId]
    );

    res.status(200).json({
      success: true,
      documents: result.rows
    });

  } catch (error) {
    console.error("Get Bank Docs error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { employee_id, id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Optionally delete the file from disk before DB deletion
    const doc = await db.query(
      `SELECT file_path FROM bank_documents WHERE id = $1 AND pr_id = $2`,
      [id, prId]
    );
    if (doc.rows.length > 0 && doc.rows[0].file_path) {
      const filePath = path.join(__dirname, "..", doc.rows[0].file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    const result = await db.query(
      `DELETE FROM bank_documents WHERE id = $1 AND pr_id = $2 RETURNING id`,
      [id, prId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    res.status(200).json({ success: true, message: "Document deleted" });

  } catch (error) {
    console.error("Delete Document error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   PROFILE IMAGE CONTROLLERS
// ============================================================

exports.addProfileImage = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image file required" });
    }

    const imagePath = `/uploads/profile-images/${req.file.filename}`;

    // Get old image path from personal
    const oldImage = await db.query(
      `SELECT pr_profile_image FROM personal WHERE pr_id = $1`,
      [prId]
    );

    // Update personal
    await db.query(
      `UPDATE personal SET pr_profile_image = $1, pr_updated_at = NOW() WHERE pr_id = $2`,
      [imagePath, prId]
    );

    // Delete old file
    if (oldImage.rows.length > 0 && oldImage.rows[0].pr_profile_image) {
      const oldPath = path.join(__dirname, "..", oldImage.rows[0].pr_profile_image);
      if (fs.existsSync(oldPath)) {
        fs.unlink(oldPath, (err) => {
          if (err) console.error("Could not delete old image:", err);
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Profile image updated",
      profile_image: imagePath
    });

  } catch (error) {
    console.error("Upload profile image error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProfileImage = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `SELECT pr_profile_image FROM personal WHERE pr_id = $1`,
      [prId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Personal record not found" });
    }

    const imagePath = result.rows[0].pr_profile_image;
    const fullUrl = imagePath ? `${req.protocol}://${req.get("host")}${imagePath}` : null;

    res.status(200).json({
      success: true,
      profile_image: fullUrl
    });

  } catch (error) {
    console.error("Get profile image error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   ADDRESS CONTROLLERS
// ============================================================

exports.addAddressInfo = async (req, res) => {
  try {
    const { employee_id, permanent_address, current_address } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id required" });
    }

    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `
      INSERT INTO address (pr_id, ad_permanent_address, ad_current_address)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [prId, permanent_address, current_address]
    );

    res.status(201).json({
      success: true,
      message: "Address added",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add Address error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAddressInfo = async (req, res) => {
  try {
    const { employee_id, permanent_address, current_address } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: "employee_id required" });
    }

    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `
      UPDATE address
      SET
        ad_permanent_address = $1,
        ad_current_address = $2,
        ad_updated_at = NOW()
      WHERE pr_id = $3
      RETURNING *
      `,
      [permanent_address, current_address, prId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.status(200).json({
      success: true,
      message: "Address updated",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Update Address error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAddressInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;
    const prId = await getPrIdByEmployeeId(employee_id);
    if (!prId) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const result = await db.query(
      `SELECT ad_permanent_address, ad_current_address FROM address WHERE pr_id = $1`,
      [prId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    res.status(200).json({
      success: true,
      address: result.rows[0]
    });

  } catch (error) {
    console.error("Get Address error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
//   HELPER FOR DATE PARSING (used in personal update)
// ============================================================
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 2) {
    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
};