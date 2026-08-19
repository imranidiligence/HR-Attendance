const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createNationality = async (req, res) => {
  try {
    const { nationality_name, created_by } = req.body;

    if (!nationality_name || nationality_name.trim() === '') {
      return errorResponse(res, 400, 'nationality_name is required', null);
    }

    const query = `
      INSERT INTO nationality_master (nationality_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [nationality_name, created_by || null]);
    return successResponse(res, 201, 'Nationality created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create nationality');
  }
};

const getNationalityById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid nationality_id is required', null);
    }

    const result = await db.query('SELECT * FROM nationality_master WHERE nationality_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Nationality not found', null);
    }
    return successResponse(res, 200, 'Nationality fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch nationality');
  }
};

const getAllNationalities = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM nationality_master${whereClause} ORDER BY nationality_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Nationalities fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch nationalities');
  }
};

const getPaginatedNationalities = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM nationality_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM nationality_master${whereClause}
      ORDER BY nationality_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Nationalities fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated nationalities');
  }
};

const updateNationality = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid nationality_id is required', null);
    }

    const existing = await db.query('SELECT * FROM nationality_master WHERE nationality_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Nationality not found', null);
    }

    const { nationality_name, updated_by, is_active } = req.body;

    if (nationality_name !== undefined && nationality_name.trim() === '') {
      return errorResponse(res, 400, 'nationality_name cannot be empty', null);
    }

    const query = `
      UPDATE nationality_master
      SET nationality_name = COALESCE($1, nationality_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE nationality_id = $4
      RETURNING *
    `;
    const values = [
      nationality_name !== undefined ? nationality_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Nationality updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update nationality');
  }
};

const deleteNationality = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid nationality_id is required', null);
    }

    const existing = await db.query('SELECT * FROM nationality_master WHERE nationality_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Nationality not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE nationality_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE nationality_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Nationality deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete nationality');
  }
};

module.exports = {
  createNationality,
  getNationalityById,
  getAllNationalities,
  getPaginatedNationalities,
  updateNationality,
  deleteNationality,
};