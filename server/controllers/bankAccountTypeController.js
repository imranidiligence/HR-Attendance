const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createBankAccountType = async (req, res) => {
  try {
    const { account_type_name, created_by } = req.body;

    if (!account_type_name || account_type_name.trim() === '') {
      return errorResponse(res, 400, 'account_type_name is required', null);
    }

    const query = `
      INSERT INTO bank_account_types (account_type_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [account_type_name, created_by || null]);
    return successResponse(res, 201, 'Bank account type created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create bank account type');
  }
};

const getBankAccountTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid id is required', null);
    }

    const result = await db.query('SELECT * FROM bank_account_types WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Bank account type not found', null);
    }
    return successResponse(res, 200, 'Bank account type fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch bank account type');
  }
};

const getAllBankAccountTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM bank_account_types${whereClause} ORDER BY id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Bank account types fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch bank account types');
  }
};

const getPaginatedBankAccountTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM bank_account_types${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM bank_account_types${whereClause}
      ORDER BY id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Bank account types fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated bank account types');
  }
};

const updateBankAccountType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid id is required', null);
    }

    const existing = await db.query('SELECT * FROM bank_account_types WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Bank account type not found', null);
    }

    const { account_type_name, updated_by, is_active } = req.body;

    if (account_type_name !== undefined && account_type_name.trim() === '') {
      return errorResponse(res, 400, 'account_type_name cannot be empty', null);
    }

    const query = `
      UPDATE bank_account_types
      SET account_type_name = COALESCE($1, account_type_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const values = [
      account_type_name !== undefined ? account_type_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Bank account type updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update bank account type');
  }
};

const deleteBankAccountType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid id is required', null);
    }

    const existing = await db.query('SELECT * FROM bank_account_types WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Bank account type not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE bank_account_types     
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Bank account type deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete bank account type');
  }
};

module.exports = {
  createBankAccountType,
  getBankAccountTypeById,
  getAllBankAccountTypes,
  getPaginatedBankAccountTypes,
  updateBankAccountType,
  deleteBankAccountType,
};