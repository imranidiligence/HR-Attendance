const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createContactType = async (req, res) => {
  try {
    const { contact_type_name, created_by } = req.body;

    if (!contact_type_name || contact_type_name.trim() === '') {
      return errorResponse(res, 400, 'contact_type_name is required', null);
    }

    const query = `
      INSERT INTO contact_type_master (contact_type_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [contact_type_name, created_by || null]);
    return successResponse(res, 201, 'Contact type created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create contact type');
  }
};

const getContactTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid contact_type_id is required', null);
    }

    const result = await db.query('SELECT * FROM contact_type_master WHERE contact_type_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Contact type not found', null);
    }
    return successResponse(res, 200, 'Contact type fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch contact type');
  }
};

const getAllContactTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM contact_type_master${whereClause} ORDER BY contact_type_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Contact types fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch contact types');
  }
};

const getPaginatedContactTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM contact_type_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM contact_type_master${whereClause}
      ORDER BY contact_type_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Contact types fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated contact types');
  }
};

const updateContactType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid contact_type_id is required', null);
    }

    const existing = await db.query('SELECT * FROM contact_type_master WHERE contact_type_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Contact type not found', null);
    }

    const { contact_type_name, updated_by, is_active } = req.body;

    if (contact_type_name !== undefined && contact_type_name.trim() === '') {
      return errorResponse(res, 400, 'contact_type_name cannot be empty', null);
    }

    const query = `
      UPDATE contact_type_master
      SET contact_type_name = COALESCE($1, contact_type_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE contact_type_id = $4
      RETURNING *
    `;
    const values = [
      contact_type_name !== undefined ? contact_type_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Contact type updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update contact type');
  }
};

const deleteContactType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid contact_type_id is required', null);
    }

    const existing = await db.query('SELECT * FROM contact_type_master WHERE contact_type_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Contact type not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE contact_type_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE contact_type_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Contact type deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete contact type');
  }
};

module.exports = {
  createContactType,
  getContactTypeById,
  getAllContactTypes,
  getPaginatedContactTypes,
  updateContactType,
  deleteContactType,
};