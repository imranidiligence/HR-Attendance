const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createCity = async (req, res) => {
  try {
    const { city_name, state_id, created_by } = req.body;

    if (!city_name || city_name.trim() === '') {
      return errorResponse(res, 400, 'city_name is required', null);
    }

    const query = `
      INSERT INTO city_master (city_name, state_id, created_by, created_at, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [city_name, state_id || null, created_by || null]);
    return successResponse(res, 201, 'City created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create city');
  }
};

const getCityById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid city_id is required', null);
    }

    const result = await db.query('SELECT cm.*, cp.pr_first_name as CreatedByName, up.pr_first_name as UpdatedByName FROM city_master cm LEFT JOIN personal cp ON cp.pr_id = cm.created_by LEFT JOIN personal up ON up.pr_id = cm.updated_by WHERE cm.city_id  = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'City not found', null);
    }
    return successResponse(res, 200, 'City fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch city');
  }
};

const getAllCities = async (req, res) => {
  try {
    const { is_active, state_id } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    let query;
    let params = [];
    if (state_id) {
      const connector = whereClause ? ' AND' : ' WHERE';
      query = `SELECT * FROM city_master${whereClause}${connector} state_id = $1 ORDER BY city_id ASC`;
      params = [state_id];
    } else {
      query = `SELECT * FROM city_master${whereClause} ORDER BY city_id ASC`;
    }

    const result = await db.query(query, params);
    return successResponse(res, 200, 'Cities fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch cities');
  }
};

const getPaginatedCities = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM city_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM city_master${whereClause}
      ORDER BY city_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Cities fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated cities');
  }
};

const updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid city_id is required', null);
    }

    const existing = await db.query('SELECT * FROM city_master WHERE city_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'City not found', null);
    }

    const { city_name, state_id, updated_by, is_active } = req.body;

    if (city_name !== undefined && city_name.trim() === '') {
      return errorResponse(res, 400, 'city_name cannot be empty', null);
    }

    const query = `
      UPDATE city_master
      SET city_name = COALESCE($1, city_name),
          state_id = COALESCE($2, state_id),
          updated_by = COALESCE($3, updated_by),
          is_active = COALESCE($4, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE city_id = $5
      RETURNING *
    `;
    const values = [
      city_name !== undefined ? city_name : null,
      state_id !== undefined ? state_id : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'City updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update city');
  }
};

const deleteCity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid city_id is required', null);
    }

    const existing = await db.query('SELECT * FROM city_master WHERE city_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'City not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE city_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE city_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'City deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete city');
  }
};

module.exports = {
  createCity,
  getCityById,
  getAllCities,
  getPaginatedCities,
  updateCity,
  deleteCity,
};