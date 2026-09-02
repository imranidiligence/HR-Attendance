const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createDegree = async (req, res) => {
  try {
    const { degree_name, created_by } = req.body;

    if (!degree_name || degree_name.trim() === '') {
      return errorResponse(res, 400, 'degree_name is required', null);
    }

    const query = `
      INSERT INTO degree_master (degree_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [degree_name, created_by || null]);
    return successResponse(res, 201, 'Degree created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create degree');
  }
};

const getDegreeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid degree_id is required', null);
    }

    const result = await db.query('SELECT dm.*, cp.pr_first_name as CreatedByName, up.pr_first_name as UpdatedByName FROM degree_master dm LEFT JOIN personal cp ON cp.pr_id = dm.created_by LEFT JOIN personal up ON up.pr_id = dm.updated_by WHERE dm.degree_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Degree not found', null);
    }
    return successResponse(res, 200, 'Degree fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch degree');
  }
};

const getAllDegrees = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM degree_master${whereClause} ORDER BY degree_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Degrees fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch degrees');
  }
};

const getPaginatedDegrees = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM degree_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM degree_master${whereClause}
      ORDER BY degree_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Degrees fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated degrees');
  }
};

const updateDegree = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid degree_id is required', null);
    }

    const existing = await db.query('SELECT * FROM degree_master WHERE degree_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Degree not found', null);
    }

    const { degree_name, updated_by, is_active } = req.body;

    if (degree_name !== undefined && degree_name.trim() === '') {
      return errorResponse(res, 400, 'degree_name cannot be empty', null);
    }

    const query = `
      UPDATE degree_master
      SET degree_name = COALESCE($1, degree_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE degree_id = $4
      RETURNING *
    `;
    const values = [
      degree_name !== undefined ? degree_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Degree updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update degree');
  }
};

const deleteDegree = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid degree_id is required', null);
    }

    const existing = await db.query('SELECT * FROM degree_master WHERE degree_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Degree not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE degree_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE degree_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Degree deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete degree');
  }
};

module.exports = {
  createDegree,
  getDegreeById,
  getAllDegrees,
  getPaginatedDegrees,
  updateDegree,
  deleteDegree,
};