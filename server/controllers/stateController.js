const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createState = async (req, res) => {
  try {
    const { state_name, country_id, created_by } = req.body;

    if (!state_name || state_name.trim() === '') {
      return errorResponse(res, 400, 'state_name is required', null);
    }

    // country_id is nullable per schema, but if provided it must reference a real country.
    // The FK constraint enforces this; invalid values surface as a 400 via handleDbError.
    const query = `
      INSERT INTO state_master (state_name, country_id, created_by, created_at, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [state_name, country_id || null, created_by || null]);
    return successResponse(res, 201, 'State created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create state');
  }
};

const getStateById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid state_id is required', null);
    }

    const result = await db.query('SELECT sm.*, cp.pr_first_name as CreatedByName, up.pr_first_name as UpdatedByName, cm.country_name FROM state_master sm LEFT JOIN personal cp ON cp.pr_id = sm.created_by LEFT JOIN personal up ON up.pr_id = sm.updated_by LEFT JOIN country_master cm ON cm.country_id = sm.country_id WHERE sm.state_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'State not found', null);
    }
    return successResponse(res, 200, 'State fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch state');
  }
};

const getAllStates = async (req, res) => {
  try {
    const { is_active, country_id } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    // Support optional filtering by parent country as a practical convenience,
    // without changing the required is_active behavior.
    let query;
    let params = [];
    if (country_id) {
      const connector = whereClause ? ' AND' : ' WHERE';
      query = `SELECT * FROM state_master${whereClause}${connector} country_id = $1 ORDER BY state_id ASC`;
      params = [country_id];
    } else {
      query = `SELECT * FROM state_master${whereClause} ORDER BY state_id ASC`;
    }

    const result = await db.query(query, params);
    return successResponse(res, 200, 'States fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch states');
  }
};

const getPaginatedStates = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM state_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM state_master${whereClause}
      ORDER BY state_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'States fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated states');
  }
};

const updateState = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid state_id is required', null);
    }

    const existing = await db.query('SELECT * FROM state_master WHERE state_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'State not found', null);
    }

    const { state_name, country_id, updated_by, is_active } = req.body;

    if (state_name !== undefined && state_name.trim() === '') {
      return errorResponse(res, 400, 'state_name cannot be empty', null);
    }

    const query = `
      UPDATE state_master
      SET state_name = COALESCE($1, state_name),
          country_id = COALESCE($2, country_id),
          updated_by = COALESCE($3, updated_by),
          is_active = COALESCE($4, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE state_id = $5
      RETURNING *
    `;
    const values = [
      state_name !== undefined ? state_name : null,
      country_id !== undefined ? country_id : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'State updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update state');
  }
};

const deleteState = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid state_id is required', null);
    }

    const existing = await db.query('SELECT * FROM state_master WHERE state_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'State not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE state_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE state_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'State deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete state');
  }
};

module.exports = {
  createState,
  getStateById,
  getAllStates,
  getPaginatedStates,
  updateState,
  deleteState,
};