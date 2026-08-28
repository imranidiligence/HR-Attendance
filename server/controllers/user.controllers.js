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
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    const {
      search = "",
      department,
      designation,
      status,
    } = req.query;

    const searchValue = search.trim();

    const conditions = [];
    const values = [];

    let paramIndex = 1;

    if (searchValue) {
      conditions.push(`
        (
          p.pr_first_name ILIKE '%' || $${paramIndex} || '%'
          OR p.pr_last_name ILIKE '%' || $${paramIndex} || '%'
          OR p.pr_email ILIKE '%' || $${paramIndex} || '%'
          OR o.or_emp_id ILIKE '%' || $${paramIndex} || '%'
          OR o.or_organization_email ILIKE '%' || $${paramIndex} || '%'
        )
      `);

      values.push(searchValue);
      paramIndex++;
    }

    if (department !== undefined && department !== "") {
      conditions.push(`
        o.or_department_id = $${paramIndex}
      `);

      values.push(department);
      paramIndex++;
    }

    if (designation !== undefined && designation !== "") {
      conditions.push(`
        o.or_designation_id = $${paramIndex}
      `);

      values.push(designation);
      paramIndex++;
    }

    if (status !== undefined && status !== "") {
      conditions.push(`
        p.pr_is_active = $${paramIndex}
      `);

      values.push(status === "true");
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countQuery = `
      SELECT COUNT(DISTINCT p.pr_id)::int AS total
      FROM public.personal p
      LEFT JOIN public.organizations o
        ON p.pr_id = o.pr_id
      ${whereClause}
    `;

    const countResult = await db.query(
      countQuery,
      values
    );

    const total = countResult.rows[0]?.total || 0;

    const dataValues = [...values];

    const limitParam = paramIndex;
    const offsetParam = paramIndex + 1;

    dataValues.push(limit);
    dataValues.push(offset);

    const dataQuery = `
      SELECT
        p.pr_id AS id,

        jsonb_build_object(
          'pr_id',
          p.pr_id,

          'email',
          p.pr_email,

          'first_name',
          p.pr_first_name,

          'last_name',
          p.pr_last_name,

          'full_name',
          TRIM(
            COALESCE(p.pr_first_name, '') ||
            ' ' ||
            COALESCE(p.pr_last_name, '')
          ),

          'dob',
          p.pr_dob,

          'gender_id',
          p.pr_gender_id,

          'blood_group_id',
          p.pr_blood_group_id,

          'marital_status_id',
          p.pr_marital_status_id,

          'nationality_id',
          p.pr_nationality_id,

          'profile_image',
          p.pr_profile_image,

          'is_active',
          p.pr_is_active,

          'created_at',
          p.pr_created_at,

          'updated_at',
          p.pr_updated_at,

          'created_by',
          p.pr_created_by,

          'updated_by',
          p.pr_updated_by
        ) AS personal,

        jsonb_build_object(
          'or_id',
          o.or_id,

          'pr_id',
          o.pr_id,

          'organization_name',
          o.or_organization_name,

          'organization_location',
          o.or_organization_location,

          'employee_id',
          o.or_emp_id,

          'is_active',
          o.or_is_active,

          'employee_type_id',
          o.or_employee_type_id,

          'reporting_location_id',
          o.or_reporting_location_id,

          'organization_email',
          o.or_organization_email,

          'reporting_to_id',
          o.or_reporting_to_id,

          'department_id',
          o.or_department_id,

          'designation_id',
          o.or_designation_id,

          'joining_date',
          o.or_joining_date,

          'leaving_date',
          o.or_leaving_date,

          'created_at',
          o.or_created_at,

          'updated_at',
          o.or_updated_at,

          'created_by',
          o.or_created_by,

          'updated_by',
          o.or_updated_by
        ) AS organization,

        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'role_id',
                r.rm_role_id,

                'role_name',
                r.rm_role_name
              )
              ORDER BY r.rm_role_id
            )
            FROM public.user_role_relation urr
            INNER JOIN public.usr_role_master r
              ON urr.rl_role_id = r.rm_role_id
            WHERE urr.pr_id = p.pr_id
          ),
          '[]'::jsonb
        ) AS roles,

        (
          SELECT jsonb_build_object(
            'login_id',
            l.lg_id,

            'has_password',
            CASE
              WHEN l.lg_password IS NOT NULL
                   AND l.lg_password <> ''
              THEN true
              ELSE false
            END
          )
          FROM public.login l
          WHERE l.pr_id = p.pr_id
          LIMIT 1
        ) AS login,

        (
          SELECT jsonb_build_object(
            'image_id',
            ui.ui_id,

            'image_path',
            ui.ui_imagepath
          )
          FROM public.user_image ui
          WHERE ui.pr_id = p.pr_id
          ORDER BY ui.ui_id DESC
          LIMIT 1
        ) AS user_image

      FROM public.personal p

      LEFT JOIN public.organizations o
        ON p.pr_id = o.pr_id

      ${whereClause}

      ORDER BY
        p.pr_is_active DESC,
        p.pr_created_at DESC,
        p.pr_id DESC

      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const result = await db.query(
      dataQuery,
      dataValues
    );

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,

      pagination: {
        currentPage: page,
        limit,
        totalRecords: total,
        totalPages,
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
    console.error("Get Employees Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


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
      `SELECT * FROM organizations WHERE pr_id = $1`,
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
  UPDATE organizations
  SET
    is_active = $1
  WHERE pr_id = $2
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


module.exports = { updateUserActiveOrInActiveStatus,loginController,changeMyPassword,getAllEmployees, getAllEmployeesPaginated,getCountOfEmployees };