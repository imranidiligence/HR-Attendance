const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createDocumentType = async (req, res) => {
  try {
    const { document_type_name, is_mandatory, created_by } = req.body;

    if (!document_type_name || document_type_name.trim() === '') {
      return errorResponse(res, 400, 'document_type_name is required', null);
    }

    const query = `
      INSERT INTO document_type_master (document_type_name, is_mandatory, created_by, created_at, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const values = [
      document_type_name,
      is_mandatory !== undefined ? Boolean(is_mandatory) : false,
      created_by || null,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 201, 'Document type created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create document type');
  }
};

const getDocumentTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid document_type_id is required', null);
    }

    const result = await db.query('SELECT dtm.*, cp.pr_first_name as CreatedByName, up.pr_first_name as UpdatedByName FROM document_type_master dtm LEFT JOIN personal cp ON cp.pr_id = dtm.created_by LEFT JOIN personal up ON up.pr_id = dtm.updated_by WHERE dtm.document_type_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Document type not found', null);
    }
    return successResponse(res, 200, 'Document type fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch document type');
  }
};

const getAllDocumentTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM document_type_master${whereClause} ORDER BY document_type_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Document types fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch document types');
  }
};

const getPaginatedDocumentTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM document_type_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM document_type_master${whereClause}
      ORDER BY document_type_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Document types fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated document types');
  }
};

const updateDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid document_type_id is required', null);
    }

    const existing = await db.query('SELECT * FROM document_type_master WHERE document_type_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Document type not found', null);
    }

    const { document_type_name, is_mandatory, updated_by, is_active } = req.body;

    if (document_type_name !== undefined && document_type_name.trim() === '') {
      return errorResponse(res, 400, 'document_type_name cannot be empty', null);
    }

    const query = `
      UPDATE document_type_master
      SET document_type_name = COALESCE($1, document_type_name),
          is_mandatory = COALESCE($2, is_mandatory),
          updated_by = COALESCE($3, updated_by),
          is_active = COALESCE($4, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE document_type_id = $5
      RETURNING *
    `;
    const values = [
      document_type_name !== undefined ? document_type_name : null,
      is_mandatory !== undefined ? Boolean(is_mandatory) : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Document type updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update document type');
  }
};

const deleteDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid document_type_id is required', null);
    }

    const existing = await db.query('SELECT * FROM document_type_master WHERE document_type_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Document type not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE document_type_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE document_type_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Document type deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete document type');
  }
};

module.exports = {
  createDocumentType,
  getDocumentTypeById,
  getAllDocumentTypes,
  getPaginatedDocumentTypes,
  updateDocumentType,
  deleteDocumentType,
};