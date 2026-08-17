const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CREATE
// vendor_type_id -> FK to vendor_type_master(id)
// employee_id    -> FK to users(id), same target table as created_by/updated_by
const createVendorDetails = async (req, res) => {
  try {
    const { vendor_type_id, vendor_name, vendor_email, vendor_number, employee_id, created_by } = req.body;

    if (!vendor_name || vendor_name.trim() === '') {
      return errorResponse(res, 400, 'vendor_name is required', null);
    }
    if (vendor_type_id === undefined || vendor_type_id === null || isNaN(vendor_type_id)) {
      return errorResponse(res, 400, 'Valid vendor_type_id is required', null);
    }
    if (employee_id !== undefined && employee_id !== null && isNaN(employee_id)) {
      return errorResponse(res, 400, 'employee_id must be a valid number', null);
    }
    if (vendor_email && !EMAIL_REGEX.test(vendor_email)) {
      return errorResponse(res, 400, 'vendor_email is not a valid email address', null);
    }

    const query = `
      INSERT INTO vendor_details
        (vendor_type_id, vendor_name, vendor_email, vendor_number, employee_id, created_by, created_at, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const values = [
      vendor_type_id,
      vendor_name,
      vendor_email || null,
      vendor_number || null,
      employee_id || null,
      created_by || null,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 201, 'Vendor details created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create vendor details');
  }
};

// GET BY ID
const getVendorDetailsById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid vendor_id is required', null);
    }

    const result = await db.query('SELECT * FROM vendor_details WHERE vendor_id = $1', [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor details not found', null);
    }
    return successResponse(res, 200, 'Vendor details fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch vendor details');
  }
};

// GET ALL (optional is_active filter, optional vendor_type_id filter)
const getAllVendorDetails = async (req, res) => {
  try {
    const { is_active, vendor_type_id } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    let query;
    let params = [];
    if (vendor_type_id) {
      const connector = whereClause ? ' AND' : ' WHERE';
      query = `SELECT * FROM vendor_details${whereClause}${connector} vendor_type_id = $1 ORDER BY vendor_id ASC`;
      params = [vendor_type_id];
    } else {
      query = `SELECT * FROM vendor_details${whereClause} ORDER BY vendor_id ASC`;
    }

    const result = await db.query(query, params);
    return successResponse(res, 200, 'Vendor details fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch vendor details');
  }
};

// PAGINATED GET
const getPaginatedVendorDetails = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countQuery = `SELECT COUNT(*)::int AS total FROM vendor_details${whereClause}`;
    const countResult = await db.query(countQuery);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM vendor_details${whereClause}
      ORDER BY vendor_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Vendor details fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated vendor details');
  }
};

// UPDATE (partial)
const updateVendorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid vendor_id is required', null);
    }

    const existing = await db.query('SELECT * FROM vendor_details WHERE vendor_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor details not found', null);
    }

    const {
      vendor_type_id,
      vendor_name,
      vendor_email,
      vendor_number,
      employee_id,
      updated_by,
      is_active,
    } = req.body;

    if (vendor_name !== undefined && vendor_name.trim() === '') {
      return errorResponse(res, 400, 'vendor_name cannot be empty', null);
    }
    if (vendor_type_id !== undefined && (vendor_type_id === null || isNaN(vendor_type_id))) {
      return errorResponse(res, 400, 'vendor_type_id must be a valid number', null);
    }
    if (employee_id !== undefined && employee_id !== null && isNaN(employee_id)) {
      return errorResponse(res, 400, 'employee_id must be a valid number', null);
    }
    if (vendor_email !== undefined && vendor_email !== null && !EMAIL_REGEX.test(vendor_email)) {
      return errorResponse(res, 400, 'vendor_email is not a valid email address', null);
    }

    const query = `
      UPDATE vendor_details
      SET vendor_type_id = COALESCE($1, vendor_type_id),
          vendor_name = COALESCE($2, vendor_name),
          vendor_email = COALESCE($3, vendor_email),
          vendor_number = COALESCE($4, vendor_number),
          employee_id = COALESCE($5, employee_id),
          updated_by = COALESCE($6, updated_by),
          is_active = COALESCE($7, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE vendor_id = $8
      RETURNING *
    `;
    const values = [
      vendor_type_id !== undefined ? vendor_type_id : null,
      vendor_name !== undefined ? vendor_name : null,
      vendor_email !== undefined ? vendor_email : null,
      vendor_number !== undefined ? vendor_number : null,
      employee_id !== undefined ? employee_id : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Vendor details updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update vendor details');
  }
};

// SOFT DELETE
const deleteVendorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid vendor_id is required', null);
    }

    const existing = await db.query('SELECT * FROM vendor_details WHERE vendor_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Vendor details not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE vendor_details
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE vendor_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Vendor details deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete vendor details');
  }
};

module.exports = {
  createVendorDetails,
  getVendorDetailsById,
  getAllVendorDetails,
  getPaginatedVendorDetails,
  updateVendorDetails,
  deleteVendorDetails,
};