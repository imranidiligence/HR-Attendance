const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

// CREATE
const createVendorType = async (req, res) => {
  try {
    const { vendor_type_code, vendor_type_name, description, created_by } = req.body;

    if (!vendor_type_code || vendor_type_code.trim() === '') {
      return errorResponse(res, 400, 'vendor_type_code is required', null);
    }
    if (!vendor_type_name || vendor_type_name.trim() === '') {
      return errorResponse(res, 400, 'vendor_type_name is required', null);
    }

    const query = `
      INSERT INTO vendor_type_master (vendor_type_code, vendor_type_name, description, created_by, created_at, is_active)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const values = [vendor_type_code, vendor_type_name, description || null, created_by || null];

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

    const result = await db.query('SELECT * FROM vendor_type_master WHERE id = $1', [id]);

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

    const query = `SELECT * FROM vendor_type_master${whereClause} ORDER BY id ASC`;
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

    const countQuery = `SELECT COUNT(*)::int AS total FROM vendor_type_master${whereClause}`;
    const countResult = await db.query(countQuery);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM vendor_type_master${whereClause}
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

    const existing = await db.query('SELECT * FROM vendor_type_master WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor type not found', null);
    }

    const { vendor_type_code, vendor_type_name, description, updated_by, is_active } = req.body;

    if (vendor_type_code !== undefined && vendor_type_code.trim() === '') {
      return errorResponse(res, 400, 'vendor_type_code cannot be empty', null);
    }
    if (vendor_type_name !== undefined && vendor_type_name.trim() === '') {
      return errorResponse(res, 400, 'vendor_type_name cannot be empty', null);
    }

    const query = `
      UPDATE vendor_type_master
      SET vendor_type_code = COALESCE($1, vendor_type_code),
          vendor_type_name = COALESCE($2, vendor_type_name),
          description = COALESCE($3, description),
          updated_by = COALESCE($4, updated_by),
          is_active = COALESCE($5, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    const values = [
      vendor_type_code !== undefined ? vendor_type_code : null,
      vendor_type_name !== undefined ? vendor_type_name : null,
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

    const existing = await db.query('SELECT * FROM vendor_type_master WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor type not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE vendor_type_master
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