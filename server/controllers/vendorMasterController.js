const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

// CREATE
const createVendorType = async (req, res) => {
  try {
    const { vendor_code, vendor_name, description, created_by,vendor_email, vendor_number } = req.body;

    if (!vendor_code || vendor_code.trim() === '') {
      return errorResponse(res, 400, 'vendor_code is required', null);
    }
    if (!vendor_name || vendor_name.trim() === '') {
      return errorResponse(res, 400, 'vendor_name is required', null);
    }
    

    const query = `
      INSERT INTO vendor_master (vendor_code, vendor_name, vendor_email, vendor_number, description, created_by, created_at, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const values = [vendor_code, vendor_name, vendor_email || null, vendor_number || null, description || null, created_by || null];

    const result = await db.query(query, values);
    return successResponse(res, 201, 'Vendor type created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create vendor type');
  }
};

// GET BY ID
const getVendorTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid id is required', null);
    }

    const result = await db.query('SELECT * FROM vendor_master WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor type not found', null);
    }
    return successResponse(res, 200, 'Vendor type fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch vendor type');
  }
};

// GET ALL (optional is_active filter)
const getAllVendorTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM vendor_master${whereClause} ORDER BY id ASC`;
    const result = await db.query(query);

    return successResponse(res, 200, 'Vendor types fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch vendor types');
  }
};

// PAGINATED GET
const getPaginatedVendorTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countQuery = `SELECT COUNT(*)::int AS total FROM vendor_master${whereClause}`;
    const countResult = await db.query(countQuery);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM vendor_master${whereClause}
      ORDER BY id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Vendor types fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated vendor types');
  }
};

// UPDATE (partial)
const updateVendorType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid id is required', null);
    }

    const existing = await db.query('SELECT * FROM vendor_master WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor type not found', null);
    }

    const { vendor_code, vendor_name, description, vendor_email, vendor_number, updated_by, is_active } = req.body;

    if (vendor_code !== undefined && vendor_code.trim() === '') {
      return errorResponse(res, 400, 'vendor_code cannot be empty', null);
    }
    if (vendor_name !== undefined && vendor_name.trim() === '') {
      return errorResponse(res, 400, 'vendor_name cannot be empty', null);
    }

    const query = `
      UPDATE vendor_master
      SET vendor_code = COALESCE($1, vendor_code),
          vendor_name = COALESCE($2, vendor_name),
          vendor_email = COALESCE($3, vendor_email),
          vendor_number = COALESCE($4, vendor_number),
          description = COALESCE($5, description),
          updated_by = COALESCE($6, updated_by),
          is_active = COALESCE($7, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;
    const values = [
      vendor_code !== undefined ? vendor_code : null,
      vendor_name !== undefined ? vendor_name : null,
      vendor_email !== undefined ? vendor_email : null,
      vendor_number !== undefined ? vendor_number : null,
      description !== undefined ? description : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Vendor type updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update vendor type');
  }
};

// SOFT DELETE
const deleteVendorType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid id is required', null);
    }

    const existing = await db.query('SELECT * FROM vendor_master WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor type not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE vendor_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Vendor type deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete vendor type');
  }
};

module.exports = {
  createVendorType,
  getVendorTypeById,
  getAllVendorTypes,
  getPaginatedVendorTypes,
  updateVendorType,
  deleteVendorType,
};