const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createGender = async (req, res) => {
  try {
    const { gender_name, created_by } = req.body;

    if (!gender_name || gender_name.trim() === '') {
      return errorResponse(res, 400, 'gender_name is required', null);
    }

    const query = `
      INSERT INTO gender_master (gender_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [gender_name, created_by || null]);
    return successResponse(res, 201, 'Gender created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create gender');
  }
};

const getGenderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid gender_id is required', null);
    }

    const result = await db.query('SELECT * FROM gender_master WHERE gender_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Gender not found', null);
    }
    return successResponse(res, 200, 'Gender fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch gender');
  }
};

const getAllGenders = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM gender_master${whereClause} ORDER BY gender_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Genders fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch genders');
  }
};

const getPaginatedGenders = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM gender_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM gender_master${whereClause}
      ORDER BY gender_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Genders fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated genders');
  }
};

const updateGender = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid gender_id is required', null);
    }

    const existing = await db.query('SELECT * FROM gender_master WHERE gender_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Gender not found', null);
    }

    const { gender_name, updated_by, is_active } = req.body;

    if (gender_name !== undefined && gender_name.trim() === '') {
      return errorResponse(res, 400, 'gender_name cannot be empty', null);
    }

    const query = `
      UPDATE gender_master
      SET gender_name = COALESCE($1, gender_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE gender_id = $4
      RETURNING *
    `;
    const values = [
      gender_name !== undefined ? gender_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Gender updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update gender');
  }
};

const deleteGender = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid gender_id is required', null);
    }

    const existing = await db.query('SELECT * FROM gender_master WHERE gender_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Gender not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE gender_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE gender_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Gender deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete gender');
  }
};

module.exports = {
  createGender,
  getGenderById,
  getAllGenders,
  getPaginatedGenders,
  updateGender,
  deleteGender,
};