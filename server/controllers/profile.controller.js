const fs = require("fs");
const multer = require("multer");
const bcrypt = require('bcrypt');
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
      reporting_to_id,
      department_id,
      designation_id,
      joining_date,
      leaving_date
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
        or_reporting_to_id,
        or_department_id,
        or_designation_id,
        or_joining_date,
        or_leaving_date,
        or_created_by
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
        $14
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
        reporting_to_id || null,
        department_id || null,
        designation_id || null,
        joining_date || null,
        leaving_date || null,
        createdBy
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
        o.or_reporting_to_id,
        o.or_department_id,
        o.or_designation_id,
        o.or_joining_date,
        o.or_leaving_date,
        o.or_created_by,
        o.or_updated_by,

        p.pr_first_name,
        p.pr_last_name,
        p.pr_email

      FROM organizations o

      INNER JOIN personal p
        ON p.pr_id = o.pr_id

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

        reporting_to_id: row.or_reporting_to_id,
        department_id: row.or_department_id,
        designation_id: row.or_designation_id,

        joining_date: row.or_joining_date,
        leaving_date: row.or_leaving_date,

        created_at: row.or_created_at,
        updated_at: row.or_updated_at,
        created_by: row.or_created_by,
        updated_by: row.or_updated_by,

        employee: {
          first_name: row.pr_first_name,
          last_name: row.pr_last_name,
          email: row.pr_email
        }
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
      reporting_to_id,
      department_id,
      designation_id,
      joining_date,
      leaving_date
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

    const existingOrganization = await client.query(
      `
      SELECT Or_Id
      FROM organizations
      WHERE Pr_Id = $1
      `,
      [employeeId]
    );

    if (existingOrganization.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Organization information not found for Pr_Id ${employeeId}`
      });
    }

    const finalIsActive =
      is_active !== undefined
        ? is_active
        : leaving_date
          ? false
          : true;

    const orgResult = await client.query(
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
        Or_Reporting_To_Id = $8,
        Or_Department_Id = $9,
        Or_Designation_Id = $10,
        Or_Joining_Date = $11,
        Or_Leaving_Date = $12,
        Or_Updated_At = CURRENT_TIMESTAMP,
        Or_Updated_By = $13
      WHERE Pr_Id = $14
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
        reporting_to_id || null,
        department_id || null,
        designation_id || null,
        joining_date || null,
        leaving_date || null,
        updatedBy,
        employeeId
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Organization information updated successfully",
      organizationData: orgResult.rows[0]
    });

  } catch (error) {
    console.error("Update Organization Error:", error);

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
      const parts = value.split("-");

      if (
        parts.length === 3 &&
        parts[0].length === 2 &&
        parts[1].length === 2 &&
        parts[2].length === 4
      ) {
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
      }

      return value;
    };

    let formattedDob;

    try {
      formattedDob = parseDob(dob);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid DOB format"
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
        CURRENT_TIMESTAMP,
        $11
      )
      RETURNING
        pr_id,
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
        pr_created_by
      `,
      [
        newEmployeeId,
        email.trim().toLowerCase(),
        first_name.trim(),
        last_name.trim(),
        formattedDob,
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

    return res.status(201).json({
      success: true,
      message: "Personal details and login credentials created successfully",
      employee_id: newEmployeeId,
      created_by: createdBy,
      personalDetails: personalResult.rows[0],
      loginDetails: {
        login_id: loginResult.rows[0].lg_id,
        employee_id: loginResult.rows[0].pr_id,
        created_at: loginResult.rows[0].lg_created_at
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
      if (!dateStr) return null;

      const value = String(dateStr).trim();
      const parts = value.split("-");

      if (
        parts.length === 3 &&
        parts[0].length === 2 &&
        parts[1].length === 2 &&
        parts[2].length === 4
      ) {
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
      }

      return value;
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
        pr_dob = $4,
        pr_gender_id = $5,
        pr_marital_status_id = $6,
        pr_nationality_id = $7,
        pr_blood_group_id = $8,
        pr_is_active = COALESCE($9, pr_is_active),
        pr_updated_at = CURRENT_TIMESTAMP,
        pr_updated_by = $10
      WHERE pr_id = $11
      RETURNING
        pr_id,
        pr_email,
        pr_first_name,
        pr_last_name,
        pr_dob,
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
              employee_id,
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
    const { employee_id, id } = req.params; 
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
      WHERE employee_id = $11
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
      SELECT id,employee_id, document_type,document_number, document_type_id, file_name, file_path, file_size, created_at, updated_at
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

   
    // if (userRole !== "admin" && requestedEmpId !== loggedInEmpId) {
    //   return res.status(403).json({ message: "Unauthorized access" });
    // }

    const imagePath = `/uploads/profile-images/${req.file.filename}`;

    // Get old image
    const oldImageResult = await db.query(
      `SELECT profile_image FROM users WHERE id = $1`,
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
      `UPDATE users SET profile_image = $1 WHERE id = $2`,
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

    // // If normal employee → only allow own image
    // if (userRole !== "admin" && requestedEmpId !== loggedInEmpId) {
    //   return res.status(403).json({ message: "Unauthorized access" });
    // }

    const result = await db.query(
      `SELECT profile_image FROM users WHERE id = $1`,
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
