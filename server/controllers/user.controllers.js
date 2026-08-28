const jwt = require("jsonwebtoken");

const bcrypt = require("bcrypt");
const { db } = require("../db/connectDB");
const {
  successResponse,
  errorResponse,
  handleDbError
} = require("../utils/response");
const sendNotification = require("../services/notification.services");



  


const loginController = async (req, res) => {
  try {
    let {
      email: identifier,
      password
    } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    identifier = String(identifier).trim().toLowerCase();
    password = String(password).trim();

    
const result = await db.query(
  `
  SELECT
      p.pr_id,
      p.pr_email,

      o.or_emp_id,

      p.pr_first_name,
      p.pr_last_name,
      p.pr_profile_image,
      p.pr_is_active,

      o.or_id,
      o.or_organization_name,
      o.or_organization_email,

      l.lg_password

  FROM personal p

  INNER JOIN login l
      ON l.pr_id = p.pr_id

  LEFT JOIN organizations o
      ON o.pr_id = p.pr_id

  WHERE
      LOWER(p.pr_email) = $1
      OR LOWER(o.or_emp_id) = $1
      OR LOWER(o.or_organization_email) = $1

  LIMIT 1
  `,
  [identifier]
);
  
    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    
    if (!user.pr_is_active) {
      return res.status(401).json({
        message: "User account is inactive"
      });
    }

    
    const isMatch = await bcrypt.compare(
      password,
      user.lg_password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    
    const roleResult = await db.query(
      `
      SELECT
          rm.rm_role_id AS role_id,
          rm.rm_role_name AS role_name

      FROM user_role_relation urr

      INNER JOIN usr_role_master rm
          ON rm.rm_role_id = urr.rl_role_id

      WHERE urr.pr_id = $1

      ORDER BY rm.rm_role_id
      `,
      [user.pr_id]
    );

    const roles = roleResult.rows;

  
    const token = jwt.sign(
      {
        id: user.pr_id,
        emp_id: user.pr_emp_id,
        role: roles.map((r) => r.role_name)
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

  
    const decoded = jwt.decode(token);

  
    return res.status(200).json({
      message: "Login successful",

      token,

      expiresAt: decoded.exp * 1000,

      user: {
        id: user.pr_id,

        name: user.pr_first_name + user.pr_last_name,

        first_name: user.pr_first_name,

        last_name: user.pr_last_name,

        email: user.pr_email,

        emp_id: user.pr_emp_id,

        organization_email: user.or_organization_email,

        organization_name: user.or_organization_name,

        profile_image: user.pr_profile_image,

        role: roles.map((r) => r.role_name)
      }
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
};


const changeMyPassword = async (req, res) => {
  try {
    const employeeId = req.user.id;

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    // Get current password from LOGIN table
    const result = await db.query(
      `
      SELECT
        l.pr_id,
        l.lg_password,
        p.pr_emp_id,
        p.pr_first_name,
        p.pr_last_name
      FROM login l
      INNER JOIN personal p
        ON p.pr_id = l.pr_id
      WHERE l.pr_id = $1
      `,
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee login not found"
      });
    }

    const user = result.rows[0];

    // Check current password
    const isMatch = await bcrypt.compare(
      String(currentPassword),
      user.lg_password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const newHashedPassword = await bcrypt.hash(
      String(newPassword),
      10
    );

    // Update password in LOGIN table
    await db.query(
      `
      UPDATE login
      SET lg_password = $1
      WHERE pr_id = $2
      `,
      [newHashedPassword, employeeId]
    );

    // Notification
    await sendNotification(
      user.pr_emp_id,
      "Your password has been changed successfully.",
      `${user.pr_first_name || ""} ${user.pr_last_name || ""}`.trim()
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM users`);
    res.status(200).json(result.rows); // return all employees
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

const getAllEmployeesPaginated = async (req, res) => {
  try {
    // ==========================================
    // Pagination
    // ==========================================

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    // ==========================================
    // Query Parameters
    // ==========================================

    const {
      search = "",
      department,
      designation,
      status,
    } = req.query;

    const searchValue = search.trim();

    // ==========================================
    // Build WHERE conditions
    // ==========================================

    const conditions = [];
    const values = [];

    let paramIndex = 1;

    // ==========================================
    // Search
    // Name / Email / Employee ID
    // ==========================================

    if (searchValue) {
      conditions.push(`
        (
          u.name ILIKE '%' || $${paramIndex} || '%'
          OR u.email ILIKE '%' || $${paramIndex} || '%'
          OR o.employeeidoforganisation::text ILIKE '%' || $${paramIndex} || '%'
        )
      `);

      values.push(searchValue);
      paramIndex++;
    }

    // ==========================================
    // Department Filter
    // ==========================================

    if (department) {
      conditions.push(`
        o.department_id = $${paramIndex}
      `);

      values.push(department);
      paramIndex++;
    }

    // ==========================================
    // Designation Filter
    // ==========================================

    if (designation) {
      conditions.push(`
        o.designation_id = $${paramIndex}
      `);

      values.push(designation);
      paramIndex++;
    }

    // ==========================================
    // Status Filter
    // ==========================================

    if (status !== undefined && status !== "") {
      conditions.push(`
        u.is_active = $${paramIndex}
      `);

      values.push(status === "true");
      paramIndex++;
    }

    // ==========================================
    // WHERE clause
    // ==========================================

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // ==========================================
    // 1. Count total records
    // ==========================================

    const countQuery = `
      SELECT COUNT(DISTINCT u.id)::int AS total

      FROM public.users u

      LEFT JOIN public.personal p
        ON u.id = p.employee_id

      LEFT JOIN public.organizations o
        ON u.id = o.employee_id

      LEFT JOIN public.department_master d
        ON d."DepartmentId" = o.department_id

      LEFT JOIN public.designation_master des
        ON o.designation_id = des.designation_id

      ${whereClause}
    `;

    const countResult = await db.query(
      countQuery,
      values
    );

    const total = countResult.rows[0].total;

    // ==========================================
    // 2. Pagination parameters
    // ==========================================

    const dataValues = [...values];

    const limitParam = paramIndex;
    const offsetParam = paramIndex + 1;

    dataValues.push(limit);
    dataValues.push(offset);

    // ==========================================
    // 3. Get employees
    // ==========================================

    const dataQuery = `
      SELECT

        -- =====================================
        -- USERS
        -- All columns except password
        -- =====================================

        to_jsonb(u) - 'password' AS user,

        -- =====================================
        -- PERSONAL
        -- =====================================

        jsonb_build_object(

  'gender',
  COALESCE(
    g.gender_name,
    p.gender::text
  ),

  'dob',
  p.dob,

  'bloodgroup',
  COALESCE(
    bg.blood_group_name,
    p.bloodgroup::text
  ),

  'maritalstatus',
  COALESCE(
    ms.marital_status_name,
    p.maritalstatus::text
  ),

  'nationality',
  COALESCE(
    n.nationality_name,
    p.nationality::text
  ),

  'current_address',
  p.current_address,

  'aadharnumber',
  p.aadharnumber,

  'nominee',
  p.nominee,

  'employee_id',
  p.employee_id,

  'department',
  COALESCE(
    d."DepartmentName",
    p.department::text
  ),

  'joining_date',
  p.joining_date,

  'designation',
  COALESCE(
    des.designation_name,
    p.designation::text
  ),

  'leaving_date',
  p.leaving_date,

  'employee_type',
  COALESCE(
    et.employee_type_name,
    p.employee_type::text
  ),

  'contact',
  p.contact,

  'permanent_address',
  p.permanent_address,

  'first_name',
  p.first_name,

  'last_name',
  p.last_name,

  'email',
  p.email,

  'nationality_id',
  p.nationality_id,

  'gender_id',
  p.gender_id,

  'marital_status_id',
  p.marital_status_id,

  'blood_group_id',
  p.blood_group_id

) AS personal,

        -- =====================================
        -- ORGANIZATION
        -- =====================================

        jsonb_build_object(

          'organization_name',
          o.organization_name,

          'organization_code',
          o.organization_code,

          'industry_type',
          o.industry_type,

          'organization_location',
          o.organization_location,

          'city',
          o.city,

          'state',
          o.state,

          'country',
          o.country,

          'is_active',
          o.is_active,

          'created_at',
          o.created_at,

          'id',
          o.id,

          'employee_type',
          COALESCE(
            et.employee_type_name,
            o.employee_type_id::text
          ),

          'employee_id',
          o.employee_id,


          'organization_email',
          o.organization_email,

          'department',
          COALESCE(
            d."DepartmentName",
            o.department_id::text
          ),

          'designation',
          COALESCE(
            des.designation_name,
            o.designation_id::text
          ),

          'joining_date',
          o.joining_date,

          'leaving_date',
          o.leaving_date,

          'official_email_id',
          o.official_email_id,

          'official_contact_no',
          o.official_contact_no,

          'reporting_to',
          reporting_user.name,

          'employeeidoforganisation',
          o.employeeidoforganisation,

          'employee_type_id',
          o.employee_type_id,

          'department_id',
          o.department_id,

          'designation_id',
          o.designation_id,

          'reporting_location_id',
          o.reporting_location_id,

          'reporting_to_id',
          o.reporting_to_id

        ) AS organization

      FROM public.users u

      -- =====================================
      -- PERSONAL
      -- =====================================

      LEFT JOIN public.personal p
        ON u.id = p.employee_id

      -- =====================================
      -- ORGANIZATION
      -- =====================================

      LEFT JOIN public.organizations o
        ON u.id = o.employee_id

      -- =====================================
      -- MASTER TABLES
      -- =====================================

      LEFT JOIN public.department_master d
        ON o.department_id = d."DepartmentId"

      LEFT JOIN public.designation_master des
        ON o.designation_id = des.designation_id

      LEFT JOIN public.employee_type_master et
        ON o.employee_type_id = et.employee_type_id

      LEFT JOIN public.branch_location_master rl
        ON o.reporting_location_id = rl.branch_location_id

      LEFT JOIN public.nationality_master n
        ON p.nationality_id = n.nationality_id

      LEFT JOIN public.gender_master g
        ON p.gender_id = g.gender_id

      LEFT JOIN public.marital_status_master ms
        ON p.marital_status_id = ms.marital_status_id

      LEFT JOIN public.blood_group_master bg
        ON p.blood_group_id = bg.blood_group_id

      -- =====================================
      -- REPORTING PERSON
      -- =====================================

      LEFT JOIN public.users reporting_user
        ON o.reporting_to_id = reporting_user.id

      ${whereClause}

      -- =====================================
      -- SORT
      -- =====================================

      ORDER BY
      u.is_active DESC,
      u.created_at DESC,
      u.id DESC

      -- =====================================
      -- PAGINATION
      -- =====================================

      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const result = await db.query(
      dataQuery,
      dataValues
    );

    // ==========================================
    // Pagination information
    // ==========================================

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,

      pagination: {
        currentPage: page,
        limit: limit,
        totalRecords: total,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },

      filters: {
        search: searchValue || null,
        department: department || null,
        designation: designation || null,
        status:
          status === undefined || status === ""
            ? null
            : status === "true",
      },

      employees: result.rows,
    });

  } catch (error) {
    console.error(
      "Get Employees Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}
const getCountOfEmployees = async (req, res) => {
  try {
        const totalEmployees = await db.query
    (`SELECT COUNT(*) AS total FROM users`);
    const activeCount = await db.query
    (`SELECT COUNT(*) AS total FROM users WHERE is_active = true`);
    const totalActiveEmployees = activeCount.rows[0].total;
    const inactiveCount = await db.query
    (`SELECT COUNT(*) AS total FROM users WHERE is_active = false`);
    const totalInactiveEmployees = inactiveCount.rows[0].total;
    const newJoinersCount = await db.query
    (`SELECT COUNT(*) AS total
FROM organizations
WHERE EXTRACT(YEAR FROM joining_date) = EXTRACT(YEAR FROM CURRENT_DATE);`);
    const totalNewJoiners = newJoinersCount.rows[0].total;
    res.status(200).json({totalEmployees: totalEmployees.rows[0].total, totalActiveEmployees, totalInactiveEmployees, totalNewJoiners });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// User Active / InActive
const updateUserActiveOrInActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate User ID
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid User ID is required', null);
    }

    // Check whether user exists
    const existing = await db.query(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'User not found', null);
    }

    const { UpdatedBy, IsActive } = req.body;

    // Validate IsActive
    if (typeof IsActive !== 'boolean') {
      return errorResponse(
        res,
        400,
        'IsActive must be true or false',
        null
      );
    }

   // Update user status
const query = `
  UPDATE users
  SET
    is_active = $1
  WHERE id = $2
  RETURNING *
`;

const result = await db.query(query, [
  IsActive,
  id
]);

    return successResponse(
      res,
      200,
      `User ${IsActive ? 'activated' : 'deactivated'} successfully`,
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      'Failed to update user status'
    );
  }
};

const resetPassword = async (req,res) =>{
  
}


module.exports = { updateUserActiveOrInActiveStatus,loginController,changeMyPassword,getAllEmployees, getAllEmployeesPaginated,getCountOfEmployees, resetPassword };