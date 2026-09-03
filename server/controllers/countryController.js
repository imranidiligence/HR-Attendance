const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createCountry = async (req, res) => {
  try {
    const { country_name, phone_code, created_by } = req.body;

    if (!country_name || country_name.trim() === '') {
      return errorResponse(res, 400, 'country_name is required', null);
    }

    const query = `
      INSERT INTO country_master (country_name, phone_code, created_by, created_at, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [country_name, phone_code || null, created_by || null]);
    return successResponse(res, 201, 'Country created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create country');
  }
};

const getCountryById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid country_id is required', null);
    }

    const result = await db.query('SELECT cm.*, cp.pr_first_name as CreatedByName, up.pr_first_name as UpdatedByName FROM country_master cm LEFT JOIN personal cp ON cp.pr_id = cm.created_by LEFT JOIN personal up ON up.pr_id = cm.updated_by WHERE cm.country_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Country not found', null);
    }
    return successResponse(res, 200, 'Country fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch country');
  }
};

const getAllCountries = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM country_master${whereClause} ORDER BY country_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Countries fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch countries');
  }
};

const getPaginatedCountries = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM country_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM country_master${whereClause}
      ORDER BY country_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Countries fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated countries');
  }
};

const updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid country_id is required', null);
    }

    const existing = await db.query('SELECT * FROM country_master WHERE country_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Country not found', null);
    }

    const { country_name, phone_code, updated_by, is_active } = req.body;

    if (country_name !== undefined && country_name.trim() === '') {
      return errorResponse(res, 400, 'country_name cannot be empty', null);
    }

    const query = `
      UPDATE country_master
      SET country_name = COALESCE($1, country_name),
          phone_code = COALESCE($2, phone_code),
          updated_by = COALESCE($3, updated_by),
          is_active = COALESCE($4, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE country_id = $5
      RETURNING *
    `;
    const values = [
      country_name !== undefined ? country_name : null,
      phone_code !== undefined ? phone_code : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Country updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update country');
  }
};

const deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid country_id is required', null);
    }

    const existing = await db.query('SELECT * FROM country_master WHERE country_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Country not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE country_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE country_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Country deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete country');
  }
};

module.exports = {
  createCountry,
  getCountryById,
  getAllCountries,
  getPaginatedCountries,
  updateCountry,
  deleteCountry,
};