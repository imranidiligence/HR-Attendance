const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createDesignation = async (req, res) => {
  try {
    const { designation_name, created_by } = req.body;

    if (!designation_name || designation_name.trim() === '') {
      return errorResponse(res, 400, 'designation_name is required', null);
    }

    const query = `
      INSERT INTO designation_master (designation_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [designation_name, created_by || null]);
    return successResponse(res, 201, 'Designation created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create designation');
  }
};

const getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid designation_id is required', null);
    }

    const result = await db.query('SELECT * FROM designation_master WHERE designation_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Designation not found', null);
    }
    return successResponse(res, 200, 'Designation fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch designation');
  }
};

const getAllDesignations = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM designation_master${whereClause} ORDER BY designation_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Designations fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch designations');
  }
};

const getPaginatedDesignations = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM designation_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM designation_master${whereClause}
      ORDER BY designation_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Designations fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated designations');
  }
};

const updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid designation_id is required', null);
    }

    const existing = await db.query('SELECT * FROM designation_master WHERE designation_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Designation not found', null);
    }

    const { designation_name, updated_by, is_active } = req.body;

    if (designation_name !== undefined && designation_name.trim() === '') {
      return errorResponse(res, 400, 'designation_name cannot be empty', null);
    }

    const query = `
      UPDATE designation_master
      SET designation_name = COALESCE($1, designation_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE designation_id = $4
      RETURNING *
    `;
    const values = [
      designation_name !== undefined ? designation_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Designation updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update designation');
  }
};

const deleteDesignation = async (req, res) => {
   try {
    const { id } = req.params;

    // Validate designation ID
    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid designation_id is required",
        null
      );
    }

    // Check designation exists
    const existing = await db.query(
      `SELECT designation_id FROM designation_master WHERE designation_id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Designation not found",
        null
      );
    }

    // Get request body
    const { is_active, updated_by } = req.body;

    // Validate is_active
    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be true or false",
        null
      );
    }

    // Update designation status
    const query = `
      UPDATE designation_master
      SET
        is_active = $1,
        updated_by = COALESCE($2, updated_by),
        updated_at = CURRENT_TIMESTAMP
      WHERE designation_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [
      is_active,
      updated_by || null,
      id
    ]);

    return successResponse(
      res,
      200,
      `Designation ${
        is_active ? "activated" : "deactivated"
      } successfully`,
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to update designation status"
    );
  }
};

const getHODsByDepartment = async (req, res) => {
    try {
    const { department_id } = req.params;

    if (!department_id) {
      return res.status(400).json({
        success: false,
        message: "Department ID is required"
      });
    }

    const departmentId = parseInt(department_id, 10);

    if (isNaN(departmentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Department ID is required"
      });
    }

    const result = await db.query(
      `
      SELECT
        p.pr_id AS employee_id,
        p.pr_first_name,
        p.pr_last_name,
        p.pr_email,
        p.pr_contact,
        o.or_id,
        o.or_emp_id,
        o.or_department_id AS department_id,
        o.or_designation_id AS designation_id,
        d.designation_name
      FROM personal p
      INNER JOIN organizations o
        ON o.pr_id = p.pr_id
      INNER JOIN designation_master d
        ON d.designation_id = o.or_designation_id
      WHERE o.or_department_id = $1
        AND d."IsHOD" = true
        AND COALESCE(o.or_is_active, true) = true
        AND COALESCE(p.pr_is_active, true) = true
      ORDER BY p.pr_first_name, p.pr_last_name
      `,
      [departmentId]
    );

    return res.status(200).json({
      success: true,
      message: "HODs fetched successfully",
      data: result.rows
    });

  } catch (error) {
    console.error("Get HODs by department error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching HODs",
      error: error.message
    });
  }
};

module.exports = {
  createDesignation,
  getDesignationById,
  getAllDesignations,
  getPaginatedDesignations,
  updateDesignation,
  deleteDesignation,
  getHODsByDepartment,
};