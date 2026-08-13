const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createBranch = async (req, res) => {
  try {
    const { branch_name, branch_code, created_by } = req.body;

    if (!branch_name || branch_name.trim() === '') {
      return errorResponse(res, 400, 'branch_name is required', null);
    }

    const query = `
      INSERT INTO branch_master (branch_name, branch_code, created_by, created_at, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [branch_name, branch_code || null, created_by || null]);
    return successResponse(res, 201, 'branch created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create branch');
  }
};

const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid branch_id is required', null);
    }

    const result = await db.query('SELECT * FROM branch_master WHERE branch_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'branch not found', null);
    }
    return successResponse(res, 200, 'branch fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch branch');
  }
};

const getAllBranches = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM branch_master${whereClause} ORDER BY branch_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Branches fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch branches');
  }
};

const getPaginatedBranches = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM branch_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM branch_master${whereClause}
      ORDER BY branch_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Branches fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated branches');
  }
};

const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid branch_id is required', null);
    }

    const existing = await db.query('SELECT * FROM branch_master WHERE branch_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'branch not found', null);
    }

    const { branch_name, branch_code, updated_by, is_active } = req.body;

    if (branch_name !== undefined && branch_name.trim() === '') {
      return errorResponse(res, 400, 'branch_name cannot be empty', null);
    }

    const query = `
      UPDATE branch_master
      SET branch_name = COALESCE($1, branch_name),
          branch_code = COALESCE($2, branch_code),
          updated_by = COALESCE($3, updated_by),
          is_active = COALESCE($4, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = $5
      RETURNING *
    `;
    const values = [
      branch_name !== undefined ? branch_name : null,
      branch_code !== undefined ? branch_code : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'branch updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update branch');
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid branch_id is required', null);
    }

    const existing = await db.query('SELECT * FROM branch_master WHERE branch_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'branch not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE branch_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'branch deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete branch');
  }
};

module.exports = {
  createBranch,
  getBranchById,
  getAllBranches,
  getPaginatedBranches,
  updateBranch,
  deleteBranch,
};