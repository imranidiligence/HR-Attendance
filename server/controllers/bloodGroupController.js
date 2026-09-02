const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createBloodGroup = async (req, res) => {
  try {
    const { blood_group_name, created_by } = req.body;

    if (!blood_group_name || blood_group_name.trim() === '') {
      return errorResponse(res, 400, 'blood_group_name is required', null);
    }

    const query = `
      INSERT INTO blood_group_master (blood_group_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [blood_group_name, created_by || null]);
    return successResponse(res, 201, 'Blood group created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create blood group');
  }
};

const getBloodGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid blood_group_id is required', null);
    }

    const result = await db.query('SELECT *,cp.pr_first_name as CreatedByName,up.pr_first_name as UpdatedByName FROM blood_group_master dm left join personal cp on cp.pr_id = dm.created_by left join personal up on up.pr_id = dm.updated_by WHERE blood_group_id  = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Blood group not found', null);
    }
    return successResponse(res, 200, 'Blood group fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch blood group');
  }
};

const getAllBloodGroups = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM blood_group_master${whereClause} ORDER BY blood_group_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Blood groups fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch blood groups');
  }
};

const getPaginatedBloodGroups = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM blood_group_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM blood_group_master${whereClause}
      ORDER BY blood_group_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Blood groups fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated blood groups');
  }
};

const updateBloodGroup = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid blood_group_id is required', null);
    }

    const existing = await db.query('SELECT * FROM blood_group_master WHERE blood_group_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Blood group not found', null);
    }

    const { blood_group_name, updated_by, is_active } = req.body;

    if (blood_group_name !== undefined && blood_group_name.trim() === '') {
      return errorResponse(res, 400, 'blood_group_name cannot be empty', null);
    }

    const query = `
      UPDATE blood_group_master
      SET blood_group_name = COALESCE($1, blood_group_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE blood_group_id = $4
      RETURNING *
    `;
    const values = [
      blood_group_name !== undefined ? blood_group_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Blood group updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update blood group');
  }
};

const deleteBloodGroup = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid blood_group_id is required', null);
    }

    const existing = await db.query('SELECT * FROM blood_group_master WHERE blood_group_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Blood group not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE blood_group_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE blood_group_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Blood group deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete blood group');
  }
};

module.exports = {
  createBloodGroup,
  getBloodGroupById,
  getAllBloodGroups,
  getPaginatedBloodGroups,
  updateBloodGroup,
  deleteBloodGroup,
};