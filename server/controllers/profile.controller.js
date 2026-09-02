const fs = require("fs");
const multer = require("multer");
const bcrypt = require('bcrypt');
const path = require("path");
const auth = require("../middlewares/authMiddleware");
const { db } = require("../db/connectDB");
const sendEmail = require("../utils/mailer");
const sendNotification = require("../services/notification.services");
// Organization

exports.addOrganizationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const {
      organization_name,
      organization_location,
      emp_id,
      is_active,
      employee_type_id,
      reporting_location_id,
      organization_email,
      official_email,
      official_contact,
      reporting_to_id,
      department_id,
      designation_id,
      joining_date,
      leaving_date,
      or_company_id 
    } = req.body;

    const createdBy = req.user?.id;

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    if (or_company_id) {
      const companyCheck = await db.query(
        `SELECT cpt_id FROM companies_master WHERE cpt_id = $1`,
        [or_company_id]
      );
      
      if (companyCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Company with ID ${or_company_id} not found`
        });
      }
    }

    const personalResult = await db.query(
      `
      SELECT
        pr_id,
        pr_first_name,
        pr_last_name,
        pr_email
      FROM personal
      WHERE pr_id = $1
      `,
      [employee_id]
    );

    if (personalResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with Pr_Id ${employee_id} not found in personal table`
      });
    }

    const existingOrganization = await db.query(
      `
      SELECT or_id
      FROM organizations
      WHERE pr_id = $1
      `,
      [employee_id]
    );

    if (existingOrganization.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Organization information already exists for employee Pr_Id ${employee_id}`
      });
    }

    if (emp_id) {
      const employeeCodeCheck = await db.query(
        `
        SELECT or_id
        FROM organizations
        WHERE or_emp_id = $1
        `,
        [emp_id]
      );

      if (employeeCodeCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Employee organization ID ${emp_id} already exists`
        });
      }
    }

    const activeStatus =
      is_active !== undefined
        ? is_active
        : !leaving_date;

    const organizationResult = await db.query(
      `
      INSERT INTO organizations (
        pr_id,
        or_organization_name,
        or_organization_location,
        or_emp_id,
        or_is_active,
        or_created_at,
        or_employee_type_id,
        or_reporting_location_id,
        or_organization_email,
        or_official_email,
        or_official_contact,
        or_reporting_to_id,
        or_department_id,
        or_designation_id,
        or_joining_date,
        or_leaving_date,
        or_created_by,
        or_company_id 
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        CURRENT_TIMESTAMP,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17 
      )
      RETURNING *
      `,
      [
        employee_id,
        organization_name || null,
        organization_location || null,
        emp_id || null,
        activeStatus,
        employee_type_id || null,
        reporting_location_id || null,
        organization_email || null,
        official_email || null,
        official_contact || null,
        reporting_to_id || null,
        department_id || null,
        designation_id || null,
        joining_date || null,
        leaving_date || null,
        createdBy,
        or_company_id || null 
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Organization information created successfully",
      data: organizationResult.rows[0]
    });

  } catch (error) {
    console.error("Organization POST error:", error);

    if (error.code === "23505") {
      if (error.constraint === "organizations_or_emp_id_key") {
        return res.status(409).json({
          success: false,
          message: "Organization employee ID already exists",
          error: error.detail
        });
      }

      return res.status(409).json({
        success: false,
        message: "Organization record already exists",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid related employee or master record",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating organization information",
      error: error.message
    });
  }
};

exports.getOrganizationInfo = async (req, res) => {
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
        o.or_id,
        o.pr_id,
        o.or_organization_name,
        o.or_organization_location,
        o.or_emp_id,
        o.or_is_active,
        o.or_created_at,
        o.or_updated_at,
        o.or_employee_type_id,
        o.or_reporting_location_id,
        o.or_organization_email,
        o.or_official_email,
        o.or_official_contact,
        o.or_reporting_to_id,
        o.or_department_id,
        o.or_designation_id,
        o.or_joining_date,
        o.or_leaving_date,
        o.or_created_by,
        o.or_updated_by,
        o.or_company_id,

        p.pr_first_name,
        p.pr_last_name,
        p.pr_email,

        ro.or_id AS reporting_or_id,
        ro.pr_id AS reporting_pr_id,
        ro.or_emp_id AS reporting_emp_id,

        rp.pr_first_name AS reporting_first_name,
        rp.pr_last_name AS reporting_last_name,
        rp.pr_email AS reporting_email,
        cm.cpt_id AS company_id,
        cm.cpt_name AS company_name,
        cm.cpt_email AS company_email,
        cm.cpt_contact_number AS company_contact_number,
        cm.cpt_website AS company_website,
        cm.cpt_logopath AS company_logo_path,
        cm.cpt_city_id AS company_city_id,
        cm.cpt_state_id AS company_state_id,
        cm.cpt_country_id AS company_country_id,
        cm.cpt_is_active AS company_is_active,
        cm.cpt_created_at AS company_created_at,
        cm.cpt_updated_at AS company_updated_at

      FROM organizations o

      INNER JOIN personal p
        ON p.pr_id = o.pr_id

      LEFT JOIN organizations ro
        ON ro.or_id = o.or_reporting_to_id

      LEFT JOIN personal rp
        ON rp.pr_id = ro.pr_id

      LEFT JOIN companies_master cm -- New JOIN added
        ON cm.cpt_id = o.or_company_id

      WHERE o.pr_id = $1
      `,
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Organization information not found for employee Pr_Id ${employee_id}`
      });
    }

    const row = result.rows[0];

    const companyData = row.or_company_id ? {
      id: row.company_id,
      name: row.company_name,
      email: row.company_email,
      contact_number: row.company_contact_number,
      website: row.company_website,
      logo_path: row.company_logo_path,
      city_id: row.company_city_id,
      state_id: row.company_state_id,
      country_id: row.company_country_id,
      is_active: row.company_is_active,
      created_at: row.company_created_at,
      updated_at: row.company_updated_at
    } : null;

    return res.status(200).json({
      success: true,
      organizationData: {
        or_id: row.or_id,
        pr_id: row.pr_id,

        organization_name: row.or_organization_name,
        organization_location: row.or_organization_location,
        emp_id: row.or_emp_id,
        is_active: row.or_is_active,

        employee_type_id: row.or_employee_type_id,
        reporting_location_id: row.or_reporting_location_id,
        organization_email: row.or_organization_email,
        official_email: row.or_official_email,
        official_contact: row.or_official_contact,

        reporting_to_id: row.or_reporting_to_id,
        department_id: row.or_department_id,
        designation_id: row.or_designation_id,

        joining_date: row.or_joining_date,
        leaving_date: row.or_leaving_date,

        created_at: row.or_created_at,
        updated_at: row.or_updated_at,
        created_by: row.or_created_by,
        updated_by: row.or_updated_by,

        or_company_id: row.or_company_id,
        company: companyData,

        employee: {
          first_name: row.pr_first_name,
          last_name: row.pr_last_name,
          email: row.pr_email
        },

        reporting_to: row.or_reporting_to_id
          ? {
              or_id: row.reporting_or_id,
              pr_id: row.reporting_pr_id,
              emp_id: row.reporting_emp_id,
              first_name: row.reporting_first_name,
              last_name: row.reporting_last_name,
              email: row.reporting_email
            }
          : null
      }
    });

  } catch (error) {
    console.error("Get Organization Info error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching organization information",
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
      organization_location,
      emp_id,
      is_active,
      employee_type_id,
      reporting_location_id,
      organization_email,
      official_email,
      official_contact,
      reporting_to_id,
      department_id,
      designation_id,
      joining_date,
      leaving_date,
      or_company_id
    } = req.body;

    const updatedBy = req.user?.id;

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    const employeeId = parseInt(employee_id, 10);

    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Employee ID"
      });
    }

    if (or_company_id) {
      const companyCheck = await client.query(
        `SELECT cpt_id FROM companies_master WHERE cpt_id = $1`,
        [or_company_id]
      );
      
      if (companyCheck.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: `Company with ID ${or_company_id} not found`
        });
      }
    }

    const personalCheck = await client.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (personalCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with Pr_Id ${employeeId} not found`
      });
    }

    const finalIsActive =
      is_active !== undefined
        ? is_active
        : leaving_date
          ? false
          : true;

    const existingOrganization = await client.query(
      `
      SELECT Or_Id
      FROM organizations
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    let orgResult;
    let message;
    let operation;

    if (existingOrganization.rowCount > 0) {
      orgResult = await client.query(
        `
        UPDATE organizations
        SET
          Or_Organization_Name = $1,
          Or_Organization_Location = $2,
          Or_Emp_Id = $3,
          Or_Is_Active = $4,
          Or_Employee_Type_Id = $5,
          Or_Reporting_Location_Id = $6,
          Or_Organization_Email = $7,
          Or_Official_Email = $8,
          Or_Official_Contact = $9,
          Or_Reporting_To_Id = $10,
          Or_Department_Id = $11,
          Or_Designation_Id = $12,
          Or_Joining_Date = $13,
          Or_Leaving_Date = $14,
          Or_Updated_At = CURRENT_TIMESTAMP,
          Or_Updated_By = $15,
          Or_Company_Id = $16 -- New field added
        WHERE Pr_Id = $17
        RETURNING *
        `,
        [
          organization_name,
          organization_location,
          emp_id,
          finalIsActive,
          employee_type_id || null,
          reporting_location_id || null,
          organization_email,
          official_email,
          official_contact,
          reporting_to_id || null,
          department_id || null,
          designation_id || null,
          joining_date || null,
          leaving_date || null,
          updatedBy,
          or_company_id || null, // New field added
          employeeId
        ]
      );

      message = "Organization information updated successfully";
      operation = "updated";
    } else {
      orgResult = await client.query(
        `
        INSERT INTO organizations (
          Pr_Id,
          Or_Organization_Name,
          Or_Organization_Location,
          Or_Emp_Id,
          Or_Is_Active,
          Or_Employee_Type_Id,
          Or_Reporting_Location_Id,
          Or_Organization_Email,
          Or_Official_Email,
          Or_Official_Contact,
          Or_Reporting_To_Id,
          Or_Department_Id,
          Or_Designation_Id,
          Or_Joining_Date,
          Or_Leaving_Date,
          Or_Created_At,
          Or_Created_By,
          Or_Updated_At,
          Or_Updated_By,
          Or_Company_Id -- New column added
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          CURRENT_TIMESTAMP,
          $16,
          CURRENT_TIMESTAMP,
          $16,
          $17 -- New value added
        )
        RETURNING *
        `,
        [
          employeeId,
          organization_name,
          organization_location,
          emp_id,
          finalIsActive,
          employee_type_id || null,
          reporting_location_id || null,
          organization_email,
          official_email,
          official_contact,
          reporting_to_id || null,
          department_id || null,
          designation_id || null,
          joining_date || null,
          leaving_date || null,
          updatedBy,
          or_company_id || null // New field added
        ]
      );

      message = "Organization information created successfully";
      operation = "created";
    }

    return res.status(200).json({
      success: true,
      message,
      operation,
      organizationData: orgResult.rows[0]
    });

  } catch (error) {
    console.error("Upsert Organization Error:", error);

    if (error.code === "23505") {
      if (error.constraint === "organizations_or_emp_id_key") {
        return res.status(409).json({
          success: false,
          message: "Employee organization ID already exists",
          error: error.detail
        });
      }

      return res.status(409).json({
        success: false,
        message: "Duplicate value already exists",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid reference value provided",
        error: error.detail
      });
    }

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
    const {
      employee_id,
      dob,
      first_name,
      last_name,
      email,
      contact,
      nationality_id,
      gender_id,
      marital_status_id,
      blood_group_id,
      password
    } = req.body;

    const createdBy = req.user?.id;

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email, and password are required fields"
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    const parseDob = (dateStr) => {
      if (!dateStr) {
        return null;
      }

      const value = String(dateStr).trim();

      if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
        const [day, month, year] = value.split("-");
        return `${year}-${month}-${day}`;
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }

      const parsedDate = new Date(value);

      if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid DOB format");
      }

      return parsedDate.toISOString().split("T")[0];
    };

    let formattedDob;

    try {
      formattedDob = parseDob(dob);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid DOB format. Use YYYY-MM-DD or DD-MM-YYYY"
      });
    }

    const emailCheck = await db.query(
      `
      SELECT pr_id
      FROM personal
      WHERE LOWER(pr_email) = LOWER($1)
      `,
      [email.trim()]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already exists in the system"
      });
    }

    let newEmployeeId;

    if (employee_id) {
      const existsCheck = await db.query(
        `
        SELECT pr_id
        FROM personal
        WHERE pr_id = $1
        `,
        [employee_id]
      );

      if (existsCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Employee ID ${employee_id} already exists`
        });
      }

      newEmployeeId = employee_id;

      await db.query(
        `
        SELECT setval(
          'personal_pr_id_seq'::regclass,
          GREATEST(
            (SELECT COALESCE(MAX(pr_id), 0) FROM personal),
            $1
          )
        )
        `,
        [newEmployeeId]
      );
    } else {
      const sequenceResult = await db.query(
        `
        SELECT nextval('personal_pr_id_seq'::regclass) AS next_id
        `
      );

      newEmployeeId = sequenceResult.rows[0].next_id;
    }

    const personalResult = await db.query(
      `
      INSERT INTO personal (
        pr_id,
        pr_email,
        pr_first_name,
        pr_last_name,
        pr_dob,
        pr_contact,
        pr_gender_id,
        pr_blood_group_id,
        pr_marital_status_id,
        pr_nationality_id,
        pr_is_active,
        pr_created_at,
        pr_created_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        CURRENT_TIMESTAMP,
        $12
      )
      RETURNING
        pr_id,
        pr_email,
        pr_first_name,
        pr_last_name,
        pr_dob,
        pr_contact,
        pr_gender_id,
        pr_blood_group_id,
        pr_marital_status_id,
        pr_nationality_id,
        pr_is_active,
        pr_created_at,
        pr_created_by
      `,
      [
        newEmployeeId,
        email.trim().toLowerCase(),
        first_name.trim(),
        last_name.trim(),
        formattedDob,
        contact ? String(contact).trim() : null,
        gender_id || null,
        blood_group_id || null,
        marital_status_id || null,
        nationality_id || null,
        true,
        createdBy
      ]
    );

    const hashedPassword = await bcrypt.hash(
      String(password),
      10
    );

    const loginResult = await db.query(
      `
      INSERT INTO login (
        pr_id,
        lg_password,
        lg_created_by,
        lg_created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP
      )
      RETURNING
        lg_id,
        pr_id,
        lg_created_at
      `,
      [
        newEmployeeId,
        hashedPassword,
        createdBy
      ]
    );

    const roleIdResult = await db.query(
      `
      SELECT COALESCE(MAX(Rl_Id), 0) + 1 AS next_rl_id
      FROM user_role_relation
      `
    );

    const nextRlId = roleIdResult.rows[0].next_rl_id;

    const roleResult = await db.query(
      `
      INSERT INTO user_role_relation (
        Rl_Id,
        Pr_Id,
        Rl_Role_Id,
        Rl_Created_By,
        Rl_Created_At
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        CURRENT_TIMESTAMP
      )
      RETURNING
        Rl_Id,
        Pr_Id,
        Rl_Role_Id,
        Rl_Created_By,
        Rl_Created_At
      `,
      [
        nextRlId,
        newEmployeeId,
        3,
        createdBy
      ]
    );

    return res.status(201).json({
      success: true,
      message:
        "Personal details, login credentials, and role assigned successfully",
      employee_id: newEmployeeId,
      created_by: createdBy,
      personalDetails: personalResult.rows[0],
      loginDetails: {
        login_id: loginResult.rows[0].lg_id,
        employee_id: loginResult.rows[0].pr_id,
        created_at: loginResult.rows[0].lg_created_at
      },
      roleDetails: {
        role_relation_id: roleResult.rows[0].rl_id,
        employee_id: roleResult.rows[0].pr_id,
        role_id: roleResult.rows[0].rl_role_id,
        created_by: roleResult.rows[0].rl_created_by,
        created_at: roleResult.rows[0].rl_created_at
      }
    });
  } catch (error) {
    console.error("Personal POST error:", error);

    if (error.code === "23505") {
      if (error.constraint === "personal_pkey") {
        return res.status(409).json({
          success: false,
          message: "Employee ID already exists",
          error: error.detail
        });
      }

      if (error.constraint === "personal_pr_email_key") {
        return res.status(409).json({
          success: false,
          message: "Email already exists in the system",
          error: error.detail
        });
      }

      if (error.constraint === "login_pkey") {
        return res.status(409).json({
          success: false,
          message: "Login ID already exists",
          error: error.detail
        });
      }

      return res.status(409).json({
        success: false,
        message: "A record with this value already exists",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid related record",
        error: error.detail
      });
    }

    if (error.code === "22007") {
      return res.status(400).json({
        success: false,
        message: "Invalid DOB format. Use YYYY-MM-DD or DD-MM-YYYY"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating personal details",
      error: error.message
    });
  }
};

exports.getPersonalInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    // Validate employee_id
    if (!employee_id) {
      return res.status(400).json({
        message: "Employee ID is required"
      });
    }

    const query = `
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
        p.pr_contact,
        p.pr_created_at,
        p.pr_created_by,
        p.pr_updated_at,
        p.pr_updated_by,
        l.lg_id,
        l.lg_password,
        l.lg_created_by,
        l.lg_updated_by,
        l.lg_created_at,
        l.lg_updated_at
      FROM personal p
      LEFT JOIN login l ON p.pr_id = l.pr_id
      WHERE p.pr_id = $1
    `;

    const result = await db.query(query, [employee_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: `Employee with ID ${employee_id} not found`
      });
    }

    // Format the response with proper field names
    const employeeData = {
      employee_id: result.rows[0].pr_id,
      email: result.rows[0].pr_email,
      first_name: result.rows[0].pr_first_name,
      last_name: result.rows[0].pr_last_name,
      date_of_birth: result.rows[0].pr_dob,
      gender_id: result.rows[0].pr_gender_id,
      blood_group_id: result.rows[0].pr_blood_group_id,
      marital_status_id: result.rows[0].pr_marital_status_id,
      nationality_id: result.rows[0].pr_nationality_id,
      is_active: result.rows[0].pr_is_active,
      contact: result.rows[0].pr_contact,
      created_at: result.rows[0].pr_created_at,
      created_by: result.rows[0].pr_created_by,
      updated_at: result.rows[0].pr_updated_at,
      updated_by: result.rows[0].pr_updated_by,
      login: result.rows[0].lg_id ? {
        login_id: result.rows[0].lg_id,
        login_created_at: result.rows[0].lg_created_at,
        login_updated_at: result.rows[0].lg_updated_at,
        login_created_by: result.rows[0].lg_created_by,
        login_updated_by: result.rows[0].lg_updated_by
      } : null
    };

    // Format date of birth if it exists
    if (employeeData.date_of_birth) {
      const dob = new Date(employeeData.date_of_birth);
      employeeData.date_of_birth = dob.toISOString().split('T')[0];
    }

    res.status(200).json({
      success: true,
      data: employeeData
    });

  } catch (error) {
    console.error("Get Personal Info error:", error);

    if (error.code === '22P02') {
      return res.status(400).json({
        message: "Invalid employee ID format",
        error: error.message
      });
    }

    res.status(500).json({
      message: "Server error while fetching personal details",
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
      dob,
      contact,
      gender_id,
      marital_status_id,
      nationality_id,
      blood_group_id,
      password,
      is_active
    } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        success: false,
        message: "First name, last name and email are required"
      });
    }

    const updatedBy = req.user?.id;

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const parseDate = (dateStr) => {
      if (dateStr === undefined || dateStr === null || String(dateStr).trim() === "") {
        return null;
      }

      const value = String(dateStr).trim();

      if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
        const [day, month, year] = value.split("-");
        return `${year}-${month}-${day}`;
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }

      const parsedDate = new Date(value);

      if (isNaN(parsedDate.getTime())) {
        return null;
      }

      return parsedDate.toISOString().split("T")[0];
    };

    const formattedDob = parseDate(dob);

    const employeeCheck = await db.query(
      `
      SELECT pr_id
      FROM personal
      WHERE pr_id = $1
      `,
      [employee_id]
    );

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employee_id} not found`
      });
    }

    const emailCheck = await db.query(
      `
      SELECT pr_id
      FROM personal
      WHERE LOWER(pr_email) = LOWER($1)
        AND pr_id <> $2
      `,
      [email.trim(), employee_id]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already exists in the system"
      });
    }

    const personalResult = await db.query(
      `
      UPDATE personal
      SET
        pr_first_name = $1,
        pr_last_name = $2,
        pr_email = $3,
        pr_dob = COALESCE($4::DATE, pr_dob),
        pr_contact = COALESCE($5, pr_contact),
        pr_gender_id = COALESCE($6, pr_gender_id),
        pr_marital_status_id = COALESCE($7, pr_marital_status_id),
        pr_nationality_id = COALESCE($8, pr_nationality_id),
        pr_blood_group_id = COALESCE($9, pr_blood_group_id),
        pr_is_active = COALESCE($10, pr_is_active),
        pr_updated_at = CURRENT_TIMESTAMP,
        pr_updated_by = $11
      WHERE pr_id = $12
      RETURNING
        pr_id,
        pr_email,
        pr_first_name,
        pr_last_name,
        pr_dob,
        pr_contact,
        pr_gender_id,
        pr_blood_group_id,
        pr_marital_status_id,
        pr_nationality_id,
        pr_profile_image,
        pr_is_active,
        pr_created_at,
        pr_updated_at,
        pr_created_by,
        pr_updated_by
      `,
      [
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        formattedDob,
        contact !== undefined && contact !== null
          ? String(contact).trim()
          : null,
        gender_id || null,
        marital_status_id || null,
        nationality_id || null,
        blood_group_id || null,
        is_active !== undefined ? is_active : null,
        updatedBy,
        employee_id
      ]
    );

    let passwordUpdated = false;
    let loginData = null;

    if (
      password !== undefined &&
      password !== null &&
      String(password).trim() !== ""
    ) {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long"
        });
      }

      const hashedPassword = await bcrypt.hash(
        String(password),
        10
      );

      const loginCheck = await db.query(
        `
        SELECT lg_id, pr_id
        FROM login
        WHERE pr_id = $1
        `,
        [employee_id]
      );

      if (loginCheck.rows.length > 0) {
        const loginResult = await db.query(
          `
          UPDATE login
          SET
            lg_password = $1,
            lg_updated_by = $2,
            lg_updated_at = CURRENT_TIMESTAMP
          WHERE pr_id = $3
          RETURNING
            lg_id,
            pr_id,
            lg_updated_at
          `,
          [
            hashedPassword,
            updatedBy,
            employee_id
          ]
        );

        loginData = loginResult.rows[0];
      } else {
        const loginResult = await db.query(
          `
          INSERT INTO login (
            pr_id,
            lg_password,
            lg_created_by,
            lg_updated_by,
            lg_created_at,
            lg_updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $3,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING
            lg_id,
            pr_id,
            lg_created_at,
            lg_updated_at
          `,
          [
            employee_id,
            hashedPassword,
            updatedBy
          ]
        );

        loginData = loginResult.rows[0];
      }

      passwordUpdated = true;
    }

    const employee = personalResult.rows[0];

    const response = {
      success: true,
      message: "Personal details updated successfully",
      data: {
        employee_id: employee.pr_id,
        email: employee.pr_email,
        first_name: employee.pr_first_name,
        last_name: employee.pr_last_name,
        date_of_birth: employee.pr_dob,
        contact: employee.pr_contact,
        gender_id: employee.pr_gender_id,
        blood_group_id: employee.pr_blood_group_id,
        marital_status_id: employee.pr_marital_status_id,
        nationality_id: employee.pr_nationality_id,
        profile_image: employee.pr_profile_image,
        is_active: employee.pr_is_active,
        created_at: employee.pr_created_at,
        updated_at: employee.pr_updated_at,
        created_by: employee.pr_created_by,
        updated_by: employee.pr_updated_by
      },
      password_updated: passwordUpdated,
      updated_by: updatedBy
    };

    if (passwordUpdated && loginData) {
      response.login = {
        login_id: loginData.lg_id,
        employee_id: loginData.pr_id,
        updated_at: loginData.lg_updated_at
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error("Update Personal Info Error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Email already exists in the system",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid related record",
        error: error.detail
      });
    }

    if (error.code === "22007") {
      return res.status(400).json({
        success: false,
        message: "Invalid date of birth format. Use YYYY-MM-DD or DD-MM-YYYY"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while updating personal details",
      error: error.message
    });
  }
};


// Education
exports.addEducationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const createdBy = req.user?.id;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    // Check whether employee exists in personal table
    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employee_id]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employee_id} not found`
      });
    }

    let educationArray = [];

    // Handle FormData
    if (typeof req.body.education === "string") {
      try {
        educationArray = JSON.parse(req.body.education);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid education JSON format"
        });
      }
    }

    // Handle JSON array
    else if (Array.isArray(req.body.education)) {
      educationArray = req.body.education;
    }

    // Handle direct array
    else if (Array.isArray(req.body)) {
      educationArray = req.body;
    }

    // Handle single education object
    else if (
      req.body &&
      typeof req.body === "object" &&
      Object.keys(req.body).length > 0
    ) {
      educationArray = [req.body];
    }

    if (!educationArray.length) {
      return res.status(400).json({
        success: false,
        message: "Education data is required"
      });
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

      const result = await db.query(
        `
        INSERT INTO education (
          Pr_Id,
          Ed_Field_Of_Study,
          Ed_Institution_Name,
          Ed_University,
          Ed_Percentage_Or_Grade,
          Ed_Passing_Year,
          Ed_Degree_Id,
          Ed_Created_By,
          Ed_Created_At
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          CURRENT_TIMESTAMP
        )
        RETURNING *
        `,
        [
          employee_id,
          field_of_study || null,
          institution_name || null,
          university || null,
          percentage_or_grade || null,
          passing_year || null,
          degree_id || null,
          createdBy
        ]
      );

      inserted.push(result.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: "Education added successfully",
      employee_id: Number(employee_id),
      created_by: createdBy,
      education: inserted
    });

  } catch (error) {
    console.error("Add Education Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while adding education",
      error: error.message
    });
  }
};

exports.getEducationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const empIdInt = parseInt(employee_id, 10);

    if (isNaN(empIdInt)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID"
      });
    }

    // Check employee exists in personal table
    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [empIdInt]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${empIdInt} not found`
      });
    }

    const { rows } = await db.query(
      `
      SELECT
        Ed_Id AS id,
        Pr_Id AS employee_id,
        Ed_Field_Of_Study AS field_of_study,
        Ed_Institution_Name AS institution_name,
        Ed_University AS university,
        Ed_Percentage_Or_Grade AS percentage_or_grade,
        Ed_Passing_Year AS passing_year,
        Ed_Degree_Id AS degree_id,
        Ed_Created_By AS created_by,
        Ed_Updated_By AS updated_by,
        Ed_Created_At AS created_at,
        Ed_Updated_At AS updated_at
      FROM education
      WHERE Pr_Id = $1
      ORDER BY Ed_Passing_Year DESC NULLS LAST, Ed_Id DESC
      `,
      [empIdInt]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No education records found",
        employee_id: empIdInt,
        education: []
      });
    }

    return res.status(200).json({
      success: true,
      employee_id: empIdInt,
      total: rows.length,
      education: rows
    });

  } catch (error) {
    console.error("Get Education Info Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching education information",
      error: error.message
    });
  }
};

exports.updateEducationInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const employeeId = parseInt(employee_id, 10);
    const updatedBy = req.user?.id;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Employee ID is required"
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    let educationEntries;

    if (typeof req.body.education === "string") {
      try {
        educationEntries = JSON.parse(req.body.education);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid education JSON format"
        });
      }
    } else if (Array.isArray(req.body.education)) {
      educationEntries = req.body.education;
    } else if (Array.isArray(req.body)) {
      educationEntries = req.body;
    } else {
      return res.status(400).json({
        success: false,
        message: "Education data is required"
      });
    }

    if (
      !Array.isArray(educationEntries) ||
      educationEntries.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Education data must contain at least one record"
      });
    }

    const processedEducation = [];

    for (let i = 0; i < educationEntries.length; i++) {
      const edu = educationEntries[i];

      if (!edu || typeof edu !== "object") {
        return res.status(400).json({
          success: false,
          message: `Invalid education data at row ${i + 1}`
        });
      }

      const {
        Ed_Id,
        id,
        degree_id,
        field_of_study,
        institution_name,
        university,
        percentage_or_grade,
        passing_year
      } = edu;

      if (!degree_id) {
        return res.status(400).json({
          success: false,
          message: `Degree ID is required for education row ${i + 1}`
        });
      }

      let educationId = null;

      if (Ed_Id || id) {
        educationId = parseInt(Ed_Id || id, 10);

        if (isNaN(educationId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid education ID at row ${i + 1}`
          });
        }
      }

      if (!educationId) {
        const existingResult = await db.query(
          `
          SELECT Ed_Id
          FROM education
          WHERE Pr_Id = $1
            AND Ed_Degree_Id = $2
            AND Ed_Passing_Year IS NOT DISTINCT FROM $3
          ORDER BY Ed_Id DESC
          LIMIT 1
          `,
          [
            employeeId,
            degree_id,
            passing_year || null
          ]
        );

        if (existingResult.rowCount > 0) {
          educationId = existingResult.rows[0].ed_id;
        }
      }

      if (educationId) {
        const updateResult = await db.query(
          `
          UPDATE education
          SET
            Ed_Degree_Id = $1,
            Ed_Field_Of_Study = $2,
            Ed_Institution_Name = $3,
            Ed_University = $4,
            Ed_Percentage_Or_Grade = $5,
            Ed_Passing_Year = $6,
            Ed_Updated_By = $7,
            Ed_Updated_At = CURRENT_TIMESTAMP
          WHERE Ed_Id = $8
            AND Pr_Id = $9
          RETURNING *
          `,
          [
            degree_id,
            field_of_study || null,
            institution_name || null,
            university || null,
            percentage_or_grade || null,
            passing_year || null,
            updatedBy,
            educationId,
            employeeId
          ]
        );

        if (updateResult.rowCount === 0) {
          return res.status(404).json({
            success: false,
            message: `Education record with ID ${educationId} was not found for employee ${employeeId}`
          });
        }

        processedEducation.push({
          action: "updated",
          data: updateResult.rows[0]
        });
      } else {
        const insertResult = await db.query(
          `
          INSERT INTO education (
            Pr_Id,
            Ed_Field_Of_Study,
            Ed_Institution_Name,
            Ed_University,
            Ed_Percentage_Or_Grade,
            Ed_Passing_Year,
            Ed_Degree_Id,
            Ed_Created_By,
            Ed_Created_At
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            CURRENT_TIMESTAMP
          )
          RETURNING *
          `,
          [
            employeeId,
            field_of_study || null,
            institution_name || null,
            university || null,
            percentage_or_grade || null,
            passing_year || null,
            degree_id,
            updatedBy
          ]
        );

        processedEducation.push({
          action: "created",
          data: insertResult.rows[0]
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Education information processed successfully",
      employee_id: employeeId,
      updated_by: updatedBy,
      education: processedEducation
    });

  } catch (error) {
    console.error("Education Upsert Error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid reference value. Please check employee or degree ID.",
        error: error.detail
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Duplicate education record.",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while processing education information",
      error: error.message
    });
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

    

    const result = await db.query(
      `
      DELETE FROM education
      WHERE ed_id = $1
        AND Pr_id = $2
      RETURNING Pr_id
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
      start_date,
      end_date,
      total_years,
      location,
      designation_id
    } = req.body;

    // JWT user ID
    const createdBy = req.user?.id;

    // -----------------------------
    // Validate Employee ID
    // -----------------------------
    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Employee ID is required"
      });
    }

    // -----------------------------
    // Validate JWT User ID
    // -----------------------------
    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    // -----------------------------
    // Check Employee Exists
    // -----------------------------
    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    // -----------------------------
    // Validate Dates
    // -----------------------------
    if (start_date) {
      const start = new Date(start_date);

      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid start date format"
        });
      }
    }

    if (end_date) {
      const end = new Date(end_date);

      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid end date format"
        });
      }
    }

    // -----------------------------
    // End Date Validation
    // -----------------------------
    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);

      if (end < start) {
        return res.status(400).json({
          success: false,
          message: "End date cannot be earlier than start date"
        });
      }
    }

    // -----------------------------
    // Insert Experience
    // -----------------------------
    const result = await db.query(
      `
      INSERT INTO experience (
        Pr_Id,
        Ex_Company_Name,
        Ex_Start_Date,
        Ex_End_Date,
        Ex_Total_Years,
        Ex_Location,
        Ex_Designation_Id,
        Ex_Created_By,
        Ex_Created_At
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        employeeId,
        company_name?.trim() || null,
        start_date || null,
        end_date || null,
        total_years || null,
        location?.trim() || null,
        designation_id || null,
        createdBy
      ]
    );

    // -----------------------------
    // Response
    // -----------------------------
    return res.status(201).json({
      success: true,
      message: "Experience created successfully",
      employee_id: employeeId,
      created_by: createdBy,
      experience: result.rows[0]
    });

  } catch (error) {
    console.error("Create Experience Error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee or designation reference",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating experience",
      error: error.message
    });
  }
};

exports.getExperienceInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Employee ID is required"
      });
    }

    // Check employee exists in personal table
    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const { rows } = await db.query(
      `
      SELECT
        Ex_Id AS experience_id,
        Pr_Id AS employee_id,
        Ex_Company_Name AS company_name,
        Ex_Start_Date AS start_date,
        Ex_End_Date AS end_date,
        Ex_Total_Years AS total_years,
        Ex_Location AS location,
        Ex_Designation_Id AS designation_id,
        Ex_Created_By AS created_by,
        Ex_Updated_By AS updated_by,
        Ex_Created_At AS created_at,
        Ex_Updated_At AS updated_at
      FROM experience
      WHERE Pr_Id = $1
      ORDER BY Ex_Start_Date DESC NULLS LAST, Ex_Id DESC
      `,
      [employeeId]
    );

    return res.status(200).json({
      success: true,
      employee_id: employeeId,
      total: rows.length,
      experience: rows
    });

  } catch (error) {
    console.error("Get Experience Info Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching experience information",
      error: error.message
    });
  }
};

exports.updateExperienceInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;

    const employeeId = parseInt(employee_id, 10);
    const experienceId = id ? parseInt(id, 10) : null;
    const updatedBy = req.user?.id;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Employee ID is required"
      });
    }

    if (id && isNaN(experienceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Experience ID"
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const {
      company_name,
      designation_id,
      start_date,
      end_date,
      total_years,
      location
    } = req.body;

    if (start_date && end_date) {
      const start = new Date(start_date);
      const end = new Date(end_date);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format"
        });
      }

      if (end < start) {
        return res.status(400).json({
          success: false,
          message: "End date cannot be earlier than start date"
        });
      }
    }

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const experienceData = [
      company_name ? company_name.trim() : null,
      designation_id || null,
      start_date || null,
      end_date || null,
      total_years || null,
      location ? location.trim() : null,
      updatedBy
    ];

    if (experienceId) {
      const result = await db.query(
        `
        UPDATE experience
        SET
          Ex_Company_Name = $1,
          Ex_Designation_Id = $2,
          Ex_Start_Date = $3,
          Ex_End_Date = $4,
          Ex_Total_Years = $5,
          Ex_Location = $6,
          Ex_Updated_By = $7,
          Ex_Updated_At = CURRENT_TIMESTAMP
        WHERE Ex_Id = $8
          AND Pr_Id = $9
        RETURNING *
        `,
        [
          ...experienceData,
          experienceId,
          employeeId
        ]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: `Experience record with ID ${experienceId} was not found for employee ${employeeId}`
        });
      }

      return res.status(200).json({
        success: true,
        message: "Experience updated successfully",
        employee_id: employeeId,
        experience_id: experienceId,
        updated_by: updatedBy,
        action: "updated",
        experience: result.rows[0]
      });
    }

    const result = await db.query(
      `
      INSERT INTO experience (
        Pr_Id,
        Ex_Company_Name,
        Ex_Designation_Id,
        Ex_Start_Date,
        Ex_End_Date,
        Ex_Total_Years,
        Ex_Location,
        Ex_Created_By,
        Ex_Created_At,
        Ex_Updated_By,
        Ex_Updated_At
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        CURRENT_TIMESTAMP,
        $8,
        CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        employeeId,
        company_name ? company_name.trim() : null,
        designation_id || null,
        start_date || null,
        end_date || null,
        total_years || null,
        location ? location.trim() : null,
        updatedBy
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Experience created successfully",
      employee_id: employeeId,
      experience_id: result.rows[0].ex_id,
      updated_by: updatedBy,
      action: "created",
      experience: result.rows[0]
    });

  } catch (error) {
    console.error("Experience Upsert Error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee or designation reference",
        error: error.detail
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Duplicate experience record",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while processing experience",
      error: error.message
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
      WHERE ex_id = $1
        AND Pr_id = $2
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

    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Employee ID is required"
      });
    }

    // Check employee exists
    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const result = await db.query(
      `
      SELECT
        Ct_Id AS contact_id,
        Pr_Id AS employee_id,
        Ct_Phone AS phone,
        Ct_Email AS email,
        Ct_Relation AS relation,
        Ct_Is_Primary AS is_primary,
        Ct_Contact_Type_Id AS contact_type_id,
        Ct_Created_By AS created_by,
        Ct_Updated_By AS updated_by,
        Ct_Created_At AS created_at,
        Ct_Updated_At AS updated_at
      FROM contact
      WHERE Pr_Id = $1
      ORDER BY Ct_Is_Primary DESC NULLS LAST, Ct_Id ASC
      `,
      [employeeId]
    );

    return res.status(200).json({
      success: true,
      employee_id: employeeId,
      total: result.rows.length,
      contacts: result.rows
    });

  } catch (error) {
    console.error("Get Contact Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching contact information",
      error: error.message
    });
  }
};

exports.addContactInfo = async (req, res) => {
  const { employee_id } = req.params;
  const createdBy = req.user?.id;

  const client = await db.connect();

  try {
    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Employee ID is required"
      });
    }

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    // Check employee exists
    const employeeCheck = await client.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const incomingContacts = Array.isArray(req.body)
      ? req.body
      : [req.body];

    if (!incomingContacts.length) {
      return res.status(400).json({
        success: false,
        message: "Contact data is required"
      });
    }

    // Get existing contacts
    const existingResult = await client.query(
      `
      SELECT
        Ct_Phone,
        Ct_Email,
        Ct_Relation,
        Ct_Is_Primary,
        Ct_Contact_Type_Id
      FROM contact
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    const existingContacts = existingResult.rows;

    // Combine existing + incoming
    const updatedList = [
      ...existingContacts,
      ...incomingContacts
    ];

    // Check only one primary contact
    const primaryContacts = updatedList.filter(
      contact => contact.Ct_Is_Primary === true ||
                 contact.is_primary === true
    );

    if (primaryContacts.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Only one contact can be marked as primary."
      });
    }

    // Check duplicate emails
    const emails = updatedList
      .map(contact =>
        (
          contact.Ct_Email ||
          contact.email ||
          ""
        ).trim().toLowerCase()
      )
      .filter(Boolean);

    const uniqueEmails = new Set(emails);

    if (uniqueEmails.size !== emails.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate emails found in contact list."
      });
    }

    await client.query("BEGIN");

    // Delete existing contacts
    await client.query(
      `
      DELETE FROM contact
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    // Insert contacts
    for (const contact of updatedList) {

      const phone =
        contact.Ct_Phone ||
        contact.phone ||
        null;

      const email =
        (
          contact.Ct_Email ||
          contact.email ||
          ""
        ).trim().toLowerCase() || null;

      const relation =
        contact.Ct_Relation ||
        contact.relation ||
        null;

      const isPrimary =
        contact.Ct_Is_Primary ??
        contact.is_primary ??
        false;

      const contactTypeId =
        contact.Ct_Contact_Type_Id ||
        contact.contact_type_id ||
        null;

      await client.query(
        `
        INSERT INTO contact (
          Pr_Id,
          Ct_Phone,
          Ct_Email,
          Ct_Relation,
          Ct_Is_Primary,
          Ct_Contact_Type_Id,
          Ct_Created_By,
          Ct_Created_At
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          CURRENT_TIMESTAMP
        )
        `,
        [
          employeeId,
          phone,
          email,
          relation,
          isPrimary,
          contactTypeId,
          createdBy
        ]
      );
    }

    await client.query("COMMIT");

    // Get inserted contacts
    const result = await client.query(
      `
      SELECT
        Ct_Id AS id,
        Pr_Id AS employee_id,
        Ct_Phone AS phone,
        Ct_Email AS email,
        Ct_Relation AS relation,
        Ct_Is_Primary AS is_primary,
        Ct_Contact_Type_Id AS contact_type_id,
        Ct_Created_By AS created_by,
        Ct_Created_At AS created_at
      FROM contact
      WHERE Pr_Id = $1
      ORDER BY Ct_Is_Primary DESC, Ct_Id ASC
      `,
      [employeeId]
    );

    return res.status(201).json({
      success: true,
      message: "Contact added successfully",
      employee_id: employeeId,
      created_by: createdBy,
      contacts: result.rows
    });

  } catch (error) {

    await client.query("ROLLBACK");

    console.error("Add Contact Error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Email already exists in contact records.",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID or contact type ID.",
        error: error.detail
      });
    }

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
  try {
    const { employee_id } = req.params;
    const employeeId = parseInt(employee_id, 10);
    const updatedBy = req.user?.id;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Employee ID is required"
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const contacts = Array.isArray(req.body) ? req.body : [req.body];

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const results = [];

    for (const contact of contacts) {
      const {
        ct_id,
        phone,
        email,
        relation,
        is_primary,
        contact_type_id
      } = contact;

      const contactId = ct_id ? parseInt(ct_id, 10) : null;

      if (ct_id && isNaN(contactId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Contact ID"
        });
      }

      const phoneValue =
        phone !== undefined && phone !== null
          ? String(phone).trim()
          : null;

      const emailValue =
        email !== undefined && email !== null
          ? String(email).trim().toLowerCase()
          : null;

      const relationValue =
        relation !== undefined && relation !== null
          ? String(relation).trim()
          : null;

      const isPrimaryValue = is_primary ?? false;
      const contactTypeValue = contact_type_id || null;

      if (contactId) {
        const contactCheck = await db.query(
          `
          SELECT Ct_Id
          FROM contact
          WHERE Ct_Id = $1
            AND Pr_Id = $2
          `,
          [contactId, employeeId]
        );

        if (contactCheck.rowCount === 0) {
          return res.status(404).json({
            success: false,
            message: `Contact record with ID ${contactId} was not found for employee ${employeeId}`
          });
        }

        const result = await db.query(
          `
          UPDATE contact
          SET
            Ct_Phone = $1,
            Ct_Email = $2,
            Ct_Relation = $3,
            Ct_Is_Primary = $4,
            Ct_Contact_Type_Id = $5,
            Ct_Updated_By = $6,
            Ct_Updated_At = CURRENT_TIMESTAMP
          WHERE Ct_Id = $7
            AND Pr_Id = $8
          RETURNING *
          `,
          [
            phoneValue,
            emailValue,
            relationValue,
            isPrimaryValue,
            contactTypeValue,
            updatedBy,
            contactId,
            employeeId
          ]
        );

        results.push({
          action: "updated",
          contact_id: contactId,
          contact: result.rows[0]
        });
      } else {
        const result = await db.query(
          `
          INSERT INTO contact (
            Pr_Id,
            Ct_Phone,
            Ct_Email,
            Ct_Relation,
            Ct_Is_Primary,
            Ct_Contact_Type_Id,
            Ct_Created_By,
            Ct_Created_At,
            Ct_Updated_By,
            Ct_Updated_At
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            CURRENT_TIMESTAMP,
            $7,
            CURRENT_TIMESTAMP
          )
          RETURNING *
          `,
          [
            employeeId,
            phoneValue,
            emailValue,
            relationValue,
            isPrimaryValue,
            contactTypeValue,
            updatedBy
          ]
        );

        results.push({
          action: "created",
          contact_id: result.rows[0].ct_id,
          contact: result.rows[0]
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Contact information processed successfully",
      employee_id: employeeId,
      updated_by: updatedBy,
      results
    });

  } catch (error) {
    console.error("Contact Upsert Error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Contact email already exists",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee or contact type reference",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while processing contact information",
      error: error.message
    });
  }
};

exports.deleteContactInfo = async (req, res) => {
  const { employee_id, id } = req.params;

   try {
    const { employee_id, id } = req.params;

    const experienceId = Number(id);

    if (isNaN(experienceId)) {
      return res.status(400).json({
        message: "Invalid Contact ID"
      });
    }

    const result = await db.query(
      `
      DELETE FROM Contact
      WHERE ct_id = $1
        AND Pr_id = $2
      RETURNING *
      `,
      [experienceId, employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Contact not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
      deletedExperience: result.rows[0]
    });

  } catch (error) {
    console.error("Delete Contact error:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};

exports.getNomineeInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    const result = await db.query(
      `
      SELECT
        Nm_Id AS id,
        Pr_Id AS employee_id,
        Nm_Nominee_Name AS nominee_name,
        Nm_Nominee_Relation AS nominee_relation,
        Nm_Nominee_Contact AS nominee_contact,
        Nm_Nominee_Percentage AS nominee_percentage,
        Nm_Created_By AS created_by,
        Nm_Updated_By AS updated_by,
        Nm_Created_At AS created_at,
        Nm_Updated_At AS updated_at
      FROM nominee
      WHERE Pr_Id = $1
      ORDER BY Nm_Id ASC
      `,
      [employeeId]
    );

    return res.status(200).json({
      success: true,
      employee_id: employeeId,
      total: result.rows.length,
      nominee: result.rows
    });

  } catch (error) {
    console.error("Get Nominee Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.addNomineeInfo = async (req, res) => {
  const client = await db.connect();

  try {
    const { employee_id } = req.params;
    const employeeId = parseInt(employee_id, 10);
    const createdBy = req.user?.id;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const employeeCheck = await client.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const { nominees } = req.body;

    if (!Array.isArray(nominees) || nominees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nominees array is required"
      });
    }

    await client.query("BEGIN");

    const percentageResult = await client.query(
      `
      SELECT COALESCE(SUM(Nm_Nominee_Percentage), 0) AS total_percentage
      FROM nominee
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    const existingTotal = Number(
      percentageResult.rows[0].total_percentage || 0
    );

    let incomingTotal = 0;

    for (const nominee of nominees) {
      const {
        nominee_name,
        nominee_relation,
        nominee_contact,
        nominee_percentage
      } = nominee;

      if (
        nominee_contact !== undefined &&
        nominee_contact !== null &&
        String(nominee_contact).trim() !== ""
      ) {
        const contactStr = String(nominee_contact).trim();

        if (!/^[0-9]{10}$/.test(contactStr)) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Nominee contact must be exactly 10 digits"
          });
        }
      }

      if (
        nominee_percentage !== undefined &&
        nominee_percentage !== null &&
        String(nominee_percentage).trim() !== ""
      ) {
        const percentage = Number(nominee_percentage);

        if (
          isNaN(percentage) ||
          percentage <= 0 ||
          percentage > 100
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Nominee percentage must be between 1 and 100"
          });
        }

        incomingTotal += percentage;
      }
    }

    if (existingTotal + incomingTotal > 100) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: `Only ${100 - existingTotal}% percentage is remaining`
      });
    }

    for (const nominee of nominees) {
      if (
        nominee.nominee_contact !== undefined &&
        nominee.nominee_contact !== null &&
        String(nominee.nominee_contact).trim() !== ""
      ) {
        const contactStr = String(
          nominee.nominee_contact
        ).trim();

        const duplicateCheck = await client.query(
          `
          SELECT Nm_Id
          FROM nominee
          WHERE Pr_Id = $1
            AND Nm_Nominee_Contact = $2
          LIMIT 1
          `,
          [employeeId, contactStr]
        );

        if (duplicateCheck.rowCount > 0) {
          await client.query("ROLLBACK");

          return res.status(409).json({
            success: false,
            message: `Nominee with contact ${contactStr} already exists`
          });
        }
      }
    }

    const inserted = [];

    for (const nominee of nominees) {
      const nomineeName =
        nominee.nominee_name !== undefined &&
        nominee.nominee_name !== null &&
        String(nominee.nominee_name).trim() !== ""
          ? String(nominee.nominee_name).trim()
          : null;

      const nomineeRelation =
        nominee.nominee_relation !== undefined &&
        nominee.nominee_relation !== null &&
        String(nominee.nominee_relation).trim() !== ""
          ? String(nominee.nominee_relation).trim()
          : null;

      const nomineeContact =
        nominee.nominee_contact !== undefined &&
        nominee.nominee_contact !== null &&
        String(nominee.nominee_contact).trim() !== ""
          ? String(nominee.nominee_contact).trim()
          : null;

      const nomineePercentage =
        nominee.nominee_percentage !== undefined &&
        nominee.nominee_percentage !== null &&
        String(nominee.nominee_percentage).trim() !== ""
          ? Number(nominee.nominee_percentage)
          : null;

      const result = await client.query(
        `
        INSERT INTO nominee (
          Pr_Id,
          Nm_Nominee_Name,
          Nm_Nominee_Relation,
          Nm_Nominee_Contact,
          Nm_Nominee_Percentage,
          Nm_Created_By,
          Nm_Created_At
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          CURRENT_TIMESTAMP
        )
        RETURNING *
        `,
        [
          employeeId,
          nomineeName,
          nomineeRelation,
          nomineeContact,
          nomineePercentage,
          createdBy
        ]
      );

      inserted.push(result.rows[0]);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Nominees added successfully",
      employee_id: employeeId,
      created_by: createdBy,
      data: inserted
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Add Nominee Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });

  } finally {
    client.release();
  }
};

exports.updateNomineeInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;

    const employeeId = parseInt(employee_id, 10);
    const nomineeId = id ? parseInt(id, 10) : null;
    const updatedBy = req.user?.id;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    if (id && isNaN(nomineeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid nominee ID"
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const {
      nominee_name,
      nominee_relation,
      nominee_contact,
      nominee_percentage
    } = req.body;

    if (
      !nominee_name ||
      !nominee_relation ||
      nominee_contact === undefined ||
      nominee_percentage === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All nominee fields are required"
      });
    }

    const nomineeName = String(nominee_name).trim();
    const nomineeRelation = String(nominee_relation).trim();
    const contactStr = String(nominee_contact).trim();

    if (!nomineeName) {
      return res.status(400).json({
        success: false,
        message: "Nominee name is required"
      });
    }

    if (!nomineeRelation) {
      return res.status(400).json({
        success: false,
        message: "Nominee relation is required"
      });
    }

    if (!/^[0-9]{10}$/.test(contactStr)) {
      return res.status(400).json({
        success: false,
        message: "Nominee contact must be exactly 10 digits"
      });
    }

    const newPercentage = Number(nominee_percentage);

    if (
      isNaN(newPercentage) ||
      newPercentage <= 0 ||
      newPercentage > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Nominee percentage must be between 1 and 100"
      });
    }

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    if (nomineeId) {
      const nomineeCheck = await db.query(
        `
        SELECT Nm_Id
        FROM nominee
        WHERE Nm_Id = $1
          AND Pr_Id = $2
        `,
        [nomineeId, employeeId]
      );

      if (nomineeCheck.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: `Nominee ${nomineeId} not found for employee ${employeeId}`
        });
      }

      const duplicateContact = await db.query(
        `
        SELECT Nm_Id
        FROM nominee
        WHERE Pr_Id = $1
          AND Nm_Nominee_Contact = $2
          AND Nm_Id != $3
        LIMIT 1
        `,
        [employeeId, contactStr, nomineeId]
      );

      if (duplicateContact.rowCount > 0) {
        return res.status(409).json({
          success: false,
          message: "Another nominee with this contact already exists"
        });
      }

      const percentageResult = await db.query(
        `
        SELECT COALESCE(SUM(Nm_Nominee_Percentage), 0) AS total_percentage
        FROM nominee
        WHERE Pr_Id = $1
          AND Nm_Id != $2
        `,
        [employeeId, nomineeId]
      );

      const existingTotal = Number(
        percentageResult.rows[0].total_percentage || 0
      );

      const projectedTotal = existingTotal + newPercentage;

      if (projectedTotal > 100) {
        return res.status(400).json({
          success: false,
          message: `Only ${100 - existingTotal}% percentage is remaining`
        });
      }

      const result = await db.query(
        `
        UPDATE nominee
        SET
          Nm_Nominee_Name = $1,
          Nm_Nominee_Relation = $2,
          Nm_Nominee_Contact = $3,
          Nm_Nominee_Percentage = $4,
          Nm_Updated_By = $5,
          Nm_Updated_At = CURRENT_TIMESTAMP
        WHERE Nm_Id = $6
          AND Pr_Id = $7
        RETURNING *
        `,
        [
          nomineeName,
          nomineeRelation,
          contactStr,
          newPercentage,
          updatedBy,
          nomineeId,
          employeeId
        ]
      );

      return res.status(200).json({
        success: true,
        message: "Nominee updated successfully",
        employee_id: employeeId,
        nominee_id: nomineeId,
        updated_by: updatedBy,
        action: "updated",
        data: result.rows[0]
      });
    }

    const duplicateContact = await db.query(
      `
      SELECT Nm_Id
      FROM nominee
      WHERE Pr_Id = $1
        AND Nm_Nominee_Contact = $2
      LIMIT 1
      `,
      [employeeId, contactStr]
    );

    if (duplicateContact.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "Nominee with this contact already exists"
      });
    }

    const percentageResult = await db.query(
      `
      SELECT COALESCE(SUM(Nm_Nominee_Percentage), 0) AS total_percentage
      FROM nominee
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    const existingTotal = Number(
      percentageResult.rows[0].total_percentage || 0
    );

    const projectedTotal = existingTotal + newPercentage;

    if (projectedTotal > 100) {
      return res.status(400).json({
        success: false,
        message: `Only ${100 - existingTotal}% percentage is remaining`
      });
    }

    const result = await db.query(
      `
      INSERT INTO nominee (
        Pr_Id,
        Nm_Nominee_Name,
        Nm_Nominee_Relation,
        Nm_Nominee_Contact,
        Nm_Nominee_Percentage,
        Nm_Created_By,
        Nm_Created_At,
        Nm_Updated_By,
        Nm_Updated_At
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        CURRENT_TIMESTAMP,
        $6,
        CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        employeeId,
        nomineeName,
        nomineeRelation,
        contactStr,
        newPercentage,
        updatedBy
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Nominee created successfully",
      employee_id: employeeId,
      nominee_id: result.rows[0].nm_id,
      updated_by: updatedBy,
      action: "created",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Nominee Upsert Error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Nominee contact already exists",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee reference",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
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
      WHERE nm_id = $1 AND Pr_id = $2
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
    const { employee_id } = req.params;

    const {
      account_holder_name,
      bank_name,
      account_number,
      ifsc_code,
      branch_name,
      is_active = true,
      account_type_id
    } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    const result = await db.query(
      `
      INSERT INTO bank_accounts (
        Pr_Id,
        Ba_Account_Holder_Name,
        Ba_Bank_Name,
        Ba_Account_Number,
        Ba_Ifsc_Code,
        Ba_Branch_Name,
        Ba_Is_Active,
        Ba_Account_Type_Id,
        Ba_Created_At
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      RETURNING *
      `,
      [
        employee_id,
        account_holder_name || null,
        bank_name || null,
        account_number || null,
        ifsc_code || null,
        branch_name || null,
        is_active,
        account_type_id || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Bank details saved successfully",
      bankInfo: result.rows[0]
    });

  } catch (error) {
    console.error("Bank save error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.getBankInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    const result = await db.query(
      `
      SELECT
        Ba_Id AS id,
        Pr_Id AS employee_id,
        Ba_Account_Holder_Name AS account_holder_name,
        Ba_Bank_Name AS bank_name,
        Ba_Account_Number AS account_number,
        Ba_Ifsc_Code AS ifsc_code,
        Ba_Branch_Name AS branch_name,
        Ba_Is_Active AS is_active,
        Ba_Created_At AS created_at,
        Ba_Updated_At AS updated_at,
        Ba_Account_Type_Id AS account_type_id,
        Ba_Created_By AS created_by,
        Ba_Updated_By AS updated_by
      FROM bank_accounts
      WHERE Pr_Id = $1
      ORDER BY Ba_Id DESC
      `,
      [employeeId]
    );

    return res.status(200).json({
      success: true,
      employee_id: employeeId,
      total: result.rows.length,
      bankDetails: result.rows
    });

  } catch (error) {
    console.error("Get Bank Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.updateBankInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const employeeId = parseInt(employee_id, 10);
    const updatedBy = req.user?.id;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const {
      account_holder_name,
      bank_name,
      account_number,
      ifsc_code,
      branch_name,
      account_type_id,
      is_active
    } = req.body;

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const recordCheck = await db.query(
      `
      SELECT Ba_Id
      FROM bank_accounts
      WHERE Pr_Id = $1
      ORDER BY Ba_Id DESC
      LIMIT 1
      `,
      [employeeId]
    );

    if (recordCheck.rowCount > 0) {
      const bankId = recordCheck.rows[0].ba_id;

      const result = await db.query(
        `
        UPDATE bank_accounts
        SET
          Ba_Account_Holder_Name = $1,
          Ba_Bank_Name = $2,
          Ba_Account_Number = $3,
          Ba_Ifsc_Code = $4,
          Ba_Branch_Name = $5,
          Ba_Is_Active = $6,
          Ba_Account_Type_Id = $7,
          Ba_Updated_By = $8,
          Ba_Updated_At = CURRENT_TIMESTAMP
        WHERE Ba_Id = $9
          AND Pr_Id = $10
        RETURNING *
        `,
        [
          account_holder_name || null,
          bank_name || null,
          account_number || null,
          ifsc_code || null,
          branch_name || null,
          is_active ?? true,
          account_type_id || null,
          updatedBy,
          bankId,
          employeeId
        ]
      );

      return res.status(200).json({
        success: true,
        message: "Bank details updated successfully",
        employee_id: employeeId,
        bank_id: bankId,
        updated_by: updatedBy,
        action: "updated",
        data: result.rows[0]
      });
    }

    const result = await db.query(
      `
      INSERT INTO bank_accounts (
        Pr_Id,
        Ba_Account_Holder_Name,
        Ba_Bank_Name,
        Ba_Account_Number,
        Ba_Ifsc_Code,
        Ba_Branch_Name,
        Ba_Is_Active,
        Ba_Account_Type_Id,
        Ba_Created_By,
        Ba_Created_At,
        Ba_Updated_By,
        Ba_Updated_At
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        CURRENT_TIMESTAMP,
        $9,
        CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        employeeId,
        account_holder_name || null,
        bank_name || null,
        account_number || null,
        ifsc_code || null,
        branch_name || null,
        is_active ?? true,
        account_type_id || null,
        updatedBy
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Bank details created successfully",
      employee_id: employeeId,
      bank_id: result.rows[0].ba_id,
      updated_by: updatedBy,
      action: "created",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Bank Upsert Error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Bank account details already exist",
        error: error.detail
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee or account type reference",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.addBankDocInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const {
      documentType,
      documentTypeId,
      documentNumber
    } = req.body;

    const employeeId = parseInt(employee_id, 10);
    const createdBy = req.user?.id || null;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Bank document is required"
      });
    }

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const filePath = `/uploads/bank-docs/${req.file.filename}`;

    const result = await db.query(
      `
      INSERT INTO documents (
        Pr_Id,
        Dc_File_Name,
        Dc_File_Path,
        Dc_File_Size,
        Dc_Created_At,
        Dc_Document_Number,
        Dc_Document_Type_Id,
        Dc_Created_By
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        CURRENT_TIMESTAMP,
        $5,
        $6,
        $7
      )
      RETURNING *
      `,
      [
        employeeId,
        req.file.filename,
        filePath,
        req.file.size,
        documentNumber || null,
        documentTypeId ? parseInt(documentTypeId, 10) : null,
        createdBy
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Bank document uploaded successfully",
      employee_id: employeeId,
      document: {
        id: result.rows[0].dc_id,
        file_name: result.rows[0].dc_file_name,
        file_path: result.rows[0].dc_file_path,
        file_size: result.rows[0].dc_file_size,
        document_number: result.rows[0].dc_document_number,
        document_type_id: result.rows[0].dc_document_type_id,
        created_by: result.rows[0].dc_created_by,
        created_at: result.rows[0].dc_created_at
      }
    });

  } catch (error) {
    console.error("Add Bank Document Error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee or document type reference",
        error: error.detail
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Document already exists",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.getAllBankDoc = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    const result = await db.query(
      `
      SELECT
        Dc_Id AS id,
        Pr_Id AS employee_id,
        Dc_File_Name AS file_name,
        Dc_File_Path AS file_path,
        Dc_File_Size AS file_size,
        Dc_Created_At AS created_at,
        Dc_Updated_At AS updated_at,
        Dc_Document_Number AS document_number,
        Dc_Document_Type_Id AS document_type_id,
        Dc_Created_By AS created_by,
        Dc_Updated_By AS updated_by
      FROM documents
      WHERE Pr_Id = $1
      ORDER BY Dc_Id DESC
      `,
      [employeeId]
    );

    return res.status(200).json({
      success: true,
      employee_id: employeeId,
      total: result.rows.length,
      documents: result.rows
    });

  } catch (error) {
    console.error("Bank Documents GET Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};


exports.updateBankDocInfo = async (req, res) => {
  try {
    const { employee_id, id } = req.params;

    const employeeId = parseInt(employee_id, 10);
    const documentId = id ? parseInt(id, 10) : null;
    const updatedBy = req.user?.id || null;

    const {
      documentTypeId,
      documentNumber
    } = req.body;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    if (id && isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID"
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    if (!documentTypeId) {
      return res.status(400).json({
        success: false,
        message: "Document type is required"
      });
    }

    const parsedDocumentTypeId = parseInt(documentTypeId, 10);

    if (isNaN(parsedDocumentTypeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type ID"
      });
    }

    if (documentId) {
      const documentCheck = await db.query(
        `
        SELECT
          Dc_Id,
          Pr_Id,
          Dc_File_Name,
          Dc_File_Path,
          Dc_File_Size,
          Dc_Document_Number,
          Dc_Document_Type_Id
        FROM documents
        WHERE Dc_Id = $1
          AND Pr_Id = $2
        `,
        [documentId, employeeId]
      );

      if (documentCheck.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: `Document with ID ${documentId} was not found for employee ${employeeId}`
        });
      }

      const oldDocument = documentCheck.rows[0];

      let fileName = oldDocument.dc_file_name;
      let filePath = oldDocument.dc_file_path;
      let fileSize = oldDocument.dc_file_size;

      if (req.file) {
        fileName = req.file.filename;
        filePath = `/uploads/bank-docs/${req.file.filename}`;
        fileSize = req.file.size;
      }

      const result = await db.query(
        `
        UPDATE documents
        SET
          Dc_File_Name = $1,
          Dc_File_Path = $2,
          Dc_File_Size = $3,
          Dc_Document_Number = $4,
          Dc_Document_Type_Id = $5,
          Dc_Updated_By = $6,
          Dc_Updated_At = CURRENT_TIMESTAMP
        WHERE Dc_Id = $7
          AND Pr_Id = $8
        RETURNING *
        `,
        [
          fileName,
          filePath,
          fileSize,
          documentNumber !== undefined
            ? documentNumber
            : oldDocument.dc_document_number,
          parsedDocumentTypeId,
          updatedBy,
          documentId,
          employeeId
        ]
      );

      return res.status(200).json({
        success: true,
        message: "Bank document updated successfully",
        employee_id: employeeId,
        document_id: documentId,
        updated_by: updatedBy,
        action: "updated",
        document: result.rows[0]
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Document file is required"
      });
    }

    const fileName = req.file.filename;
    const filePath = `/uploads/bank-docs/${req.file.filename}`;
    const fileSize = req.file.size;

    const result = await db.query(
      `
      INSERT INTO documents (
        Pr_Id,
        Dc_File_Name,
        Dc_File_Path,
        Dc_File_Size,
        Dc_Document_Number,
        Dc_Document_Type_Id,
        Dc_Created_By,
        Dc_Created_At,
        Dc_Updated_By,
        Dc_Updated_At
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        CURRENT_TIMESTAMP,
        $7,
        CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        employeeId,
        fileName,
        filePath,
        fileSize,
        documentNumber || null,
        parsedDocumentTypeId,
        updatedBy
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Bank document created successfully",
      employee_id: employeeId,
      document_id: result.rows[0].dc_id,
      updated_by: updatedBy,
      action: "created",
      document: result.rows[0]
    });

  } catch (error) {
    console.error("Bank Document Upsert Error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee or document type reference",
        error: error.detail
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Document already exists",
        error: error.detail
      });
    }

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
      DELETE FROM documents
      WHERE dc_id = $1 AND Pr_id = $2
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

exports.addProfileImage = async (req, res) => {
  try {
    const { emp_id } = req.params;

    const employeeId = parseInt(emp_id, 10);
    const createdBy = req.user?.id || null;

    if (!emp_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile image is required"
      });
    }

    // Check employee exists
    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const imagePath = `/uploads/profile-images/${req.file.filename}`;

    // Check existing image
    const oldImageResult = await db.query(
      `
      SELECT
        Ui_Id,
        Ui_ImagePath
      FROM User_Image
      WHERE Pr_Id = $1
      ORDER BY Ui_Id DESC
      LIMIT 1
      `,
      [employeeId]
    );

    const oldImage = oldImageResult.rows[0];

    // Insert new image
    const result = await db.query(
      `
      INSERT INTO User_Image (
        Pr_Id,
        Ui_ImagePath,
        Ui_Created_By,
        Ui_Created_At
      )
      VALUES (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP
      )
      RETURNING *
      `,
      [
        employeeId,
        imagePath,
        createdBy
      ]
    );

    // Delete old image file
    if (oldImage?.ui_imagepath) {
      const oldFilePath = path.join(
        __dirname,
        "..",
        oldImage.ui_imagepath
      );

      if (fs.existsSync(oldFilePath)) {
        fs.unlink(oldFilePath, (err) => {
          if (err) {
            console.error(
              "Failed to delete old profile image:",
              err
            );
          }
        });
      }
    }

    // Delete old DB record
    if (oldImage?.ui_id) {
      await db.query(
        `
        DELETE FROM User_Image
        WHERE Ui_Id = $1
        `,
        [oldImage.ui_id]
      );
    }

    return res.status(200).json({
      success: true,
      message: oldImage
        ? "Profile image updated successfully"
        : "Profile image added successfully",
      employee_id: employeeId,
      profile_image: imagePath,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add Profile Image Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.getProfileImage = async (req, res) => {
  try {
    const { emp_id } = req.params;

    const employeeId = parseInt(emp_id, 10);

    if (!emp_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID is required"
      });
    }

    const result = await db.query(
      `
      SELECT
        Ui_Id AS id,
        Pr_Id AS employee_id,
        Ui_ImagePath AS image_path,
        Ui_Created_By AS created_by,
        Ui_Updated_By AS updated_by,
        Ui_Created_At AS created_at,
        Ui_Updated_At AS updated_at
      FROM User_Image
      WHERE Pr_Id = $1
      ORDER BY Ui_Id DESC
      LIMIT 1
      `,
      [employeeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile image not found"
      });
    }

    const image = result.rows[0];

    const imagePath = image.image_path
      ? image.image_path.startsWith("/")
        ? image.image_path
        : `/${image.image_path}`
      : null;

    const fullImageUrl = imagePath
      ? `${req.protocol}://${req.get("host")}${imagePath}`
      : null;

    return res.status(200).json({
      success: true,
      employee_id: employeeId,
      profile_image: fullImageUrl,
      data: {
        ...image,
        image_path: fullImageUrl
      }
    });

  } catch (error) {
    console.error("Get Profile Image Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.addAddressInfo = async (req, res) => {
  try {
    const { employee_id, permanent_address, current_address } = req.body;
    const createdBy = req.user?.id;

    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee_id is required"
      });
    }

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    // Check employee exists
    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const result = await db.query(
      `
      INSERT INTO address (
        Pr_Id,
        Ad_Perment_Address,
        Ad_Current_Address,
        Ad_Is_Active,
        Ad_Created_At,
        Ad_Created_By
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        CURRENT_TIMESTAMP,
        $5
      )
      RETURNING *
      `,
      [
        employeeId,
        permanent_address || null,
        current_address || null,
        true,
        createdBy
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Address info added successfully",
      employee_id: employeeId,
      created_by: createdBy,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add Address Error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

exports.updateAddressInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const {
      permanent_address,
      current_address,
      is_active
    } = req.body;

    const employeeId = parseInt(employee_id, 10);
    const updatedBy = req.user?.id;

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee_id is required"
      });
    }

    if (!updatedBy) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in JWT token"
      });
    }

    const employeeCheck = await db.query(
      `
      SELECT Pr_Id
      FROM personal
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (employeeCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Employee with ID ${employeeId} not found`
      });
    }

    const addressCheck = await db.query(
      `
      SELECT Ad_Id
      FROM address
      WHERE Pr_Id = $1
      ORDER BY Ad_Id DESC
      LIMIT 1
      `,
      [employeeId]
    );

    if (addressCheck.rowCount > 0) {
      const addressId = addressCheck.rows[0].ad_id;

      const result = await db.query(
        `
        UPDATE address
        SET
          Ad_Perment_Address = $1,
          Ad_Current_Address = $2,
          Ad_Is_Active = $3,
          Ad_Updated_By = $4,
          Ad_Updated_At = CURRENT_TIMESTAMP
        WHERE Ad_Id = $5
          AND Pr_Id = $6
        RETURNING
          Ad_Id AS id,
          Pr_Id AS employee_id,
          Ad_Perment_Address AS permanent_address,
          Ad_Current_Address AS current_address,
          Ad_Is_Active AS is_active,
          Ad_Created_At AS created_at,
          Ad_Created_By AS created_by,
          Ad_Updated_By AS updated_by,
          Ad_Updated_At AS updated_at
        `,
        [
          permanent_address || null,
          current_address || null,
          is_active ?? true,
          updatedBy,
          addressId,
          employeeId
        ]
      );

      return res.status(200).json({
        success: true,
        message: "Address information updated successfully",
        employee_id: employeeId,
        address_id: addressId,
        action: "updated",
        updated_by: updatedBy,
        address: result.rows[0]
      });
    }

    const result = await db.query(
      `
      INSERT INTO address (
        Pr_Id,
        Ad_Perment_Address,
        Ad_Current_Address,
        Ad_Is_Active,
        Ad_Created_By,
        Ad_Created_At,
        Ad_Updated_By,
        Ad_Updated_At
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        CURRENT_TIMESTAMP,
        $5,
        CURRENT_TIMESTAMP
      )
      RETURNING
        Ad_Id AS id,
        Pr_Id AS employee_id,
        Ad_Perment_Address AS permanent_address,
        Ad_Current_Address AS current_address,
        Ad_Is_Active AS is_active,
        Ad_Created_At AS created_at,
        Ad_Created_By AS created_by,
        Ad_Updated_By AS updated_by,
        Ad_Updated_At AS updated_at
      `,
      [
        employeeId,
        permanent_address || null,
        current_address || null,
        is_active ?? true,
        updatedBy
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Address information created successfully",
      employee_id: employeeId,
      address_id: result.rows[0].id,
      action: "created",
      updated_by: updatedBy,
      address: result.rows[0]
    });

  } catch (error) {
    console.error("Address Upsert Error:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid employee reference",
        error: error.detail
      });
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Address information already exists",
        error: error.detail
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while processing address information",
      error: error.message
    });
  }
};

exports.getAddressInfo = async (req, res) => {
  try {
    const { employee_id } = req.params;

    const employeeId = parseInt(employee_id, 10);

    if (!employee_id || isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee_id is required"
      });
    }

    const result = await db.query(
      `
      SELECT
        Ad_Id AS id,
        Pr_Id AS employee_id,
        Ad_Perment_Address AS permanent_address,
        Ad_Current_Address AS current_address,
        Ad_Is_Active AS is_active,
        Ad_Created_At AS created_at,
        Ad_Created_By AS created_by,
        Ad_Updated_By AS updated_by,
        Ad_Updated_At AS updated_at
      FROM address
      WHERE Pr_Id = $1
      ORDER BY Ad_Id DESC
      LIMIT 1
      `,
      [employeeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Address info not found"
      });
    }

    return res.status(200).json({
      success: true,
      employee_id: employeeId,
      address: result.rows[0]
    });

  } catch (error) {
    console.error("Get Address Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};