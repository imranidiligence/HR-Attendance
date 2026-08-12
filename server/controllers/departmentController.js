const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

// CREATE
const createDepartment = async (req, res) => {
  try {
    const { DepartmentName, CreatedBy } = req.body;

    if (!DepartmentName || DepartmentName.trim() === '') {
      return errorResponse(res, 400, 'DepartmentName is required', null);
    }

    const query = `
      INSERT INTO "department_master" ("DepartmentName", "CreatedBy", "CreatedAt", "IsActive")
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const values = [DepartmentName, CreatedBy || null];

    const result = await db.query(query, values);
    return successResponse(res, 201, 'Department created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create department');
  }
};

// GET BY ID
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid DepartmentId is required', null);
    }

    const query = `SELECT * FROM "department_master" WHERE "DepartmentId" = $1`;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Department not found', null);
    }
    return successResponse(res, 200, 'Department fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch department');
  }
};

// GET ALL (optional is_active filter)
const getAllDepartments = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active, '"IsActive"');

    const query = `SELECT * FROM "department_master"${whereClause} ORDER BY "DepartmentId" ASC`;
    const result = await db.query(query);

    return successResponse(res, 200, 'Departments fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch departments');
  }
};

// PAGINATED GET
const getPaginatedDepartments = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active, '"IsActive"');

    const countQuery = `SELECT COUNT(*)::int AS total FROM "department_master"${whereClause}`;
    const countResult = await db.query(countQuery);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM "department_master"${whereClause}
      ORDER BY "DepartmentId" ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Departments fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated departments');
  }
};

// UPDATE (partial)
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid DepartmentId is required', null);
    }

    const existing = await db.query(`SELECT * FROM "department_master" WHERE "DepartmentId" = $1`, [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Department not found', null);
    }

    const { DepartmentName, UpdatedBy, IsActive } = req.body;

    if (DepartmentName !== undefined && DepartmentName.trim() === '') {
      return errorResponse(res, 400, 'DepartmentName cannot be empty', null);
    }

    const query = `
      UPDATE "department_master"
      SET "DepartmentName" = COALESCE($1, "DepartmentName"),
          "UpdatedBy" = COALESCE($2, "UpdatedBy"),
          "IsActive" = COALESCE($3, "IsActive"),
          "UpdatedAt" = CURRENT_TIMESTAMP
      WHERE "DepartmentId" = $4
      RETURNING *
    `;
    const values = [
      DepartmentName !== undefined ? DepartmentName : null,
      UpdatedBy !== undefined ? UpdatedBy : null,
      IsActive !== undefined ? IsActive : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Department updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update department');
  }
};

// SOFT DELETE
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid DepartmentId is required', null);
    }

    const existing = await db.query(`SELECT * FROM "department_master" WHERE "DepartmentId" = $1`, [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Department not found', null);
    }

    const { UpdatedBy } = req.body;

    const query = `
      UPDATE "department_master"
      SET "IsActive" = FALSE,
          "UpdatedBy" = COALESCE($1, "UpdatedBy"),
          "UpdatedAt" = CURRENT_TIMESTAMP
      WHERE "DepartmentId" = $2
      RETURNING *
    `;
    const result = await db.query(query, [UpdatedBy || null, id]);
    return successResponse(res, 200, 'Department deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete department');
  }
};

module.exports = {
  createDepartment,
  getDepartmentById,
  getAllDepartments,
  getPaginatedDepartments,
  updateDepartment,
  deleteDepartment,
};