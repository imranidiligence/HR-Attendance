const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createMaritalStatus = async (req, res) => {
  try {
    const { marital_status_name, created_by } = req.body;

    if (!marital_status_name || marital_status_name.trim() === '') {
      return errorResponse(res, 400, 'marital_status_name is required', null);
    }

    const query = `
      INSERT INTO marital_status_master (marital_status_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [marital_status_name, created_by || null]);
    return successResponse(res, 201, 'Marital status created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create marital status');
  }
};

const getMaritalStatusById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid marital_status_id is required', null);
    }

    const result = await db.query('SELECT * FROM marital_status_master WHERE marital_status_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Marital status not found', null);
    }
    return successResponse(res, 200, 'Marital status fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch marital status');
  }
};

const getAllMaritalStatuses = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM marital_status_master${whereClause} ORDER BY marital_status_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Marital statuses fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch marital statuses');
  }
};

const getPaginatedMaritalStatuses = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM marital_status_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM marital_status_master${whereClause}
      ORDER BY marital_status_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Marital statuses fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated marital statuses');
  }
};

const updateMaritalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid marital_status_id is required', null);
    }

    const existing = await db.query('SELECT * FROM marital_status_master WHERE marital_status_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Marital status not found', null);
    }

    const { marital_status_name, updated_by, is_active } = req.body;

    if (marital_status_name !== undefined && marital_status_name.trim() === '') {
      return errorResponse(res, 400, 'marital_status_name cannot be empty', null);
    }

    const query = `
      UPDATE marital_status_master
      SET marital_status_name = COALESCE($1, marital_status_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE marital_status_id = $4
      RETURNING *
    `;
    const values = [
      marital_status_name !== undefined ? marital_status_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Marital status updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update marital status');
  }
};

const deleteMaritalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid marital_status_id is required', null);
    }

    const existing = await db.query('SELECT * FROM marital_status_master WHERE marital_status_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Marital status not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE marital_status_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE marital_status_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Marital status deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete marital status');
  }
};

module.exports = {
  createMaritalStatus,
  getMaritalStatusById,
  getAllMaritalStatuses,
  getPaginatedMaritalStatuses,
  updateMaritalStatus,
  deleteMaritalStatus,
};