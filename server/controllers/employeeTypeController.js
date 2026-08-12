const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createEmployeeType = async (req, res) => {
  try {
    const { employee_type_name, created_by } = req.body;

    if (!employee_type_name || employee_type_name.trim() === '') {
      return errorResponse(res, 400, 'employee_type_name is required', null);
    }

    const query = `
      INSERT INTO employee_type_master (employee_type_name, created_by, created_at, is_active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [employee_type_name, created_by || null]);
    return successResponse(res, 201, 'Employee type created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create employee type');
  }
};

const getEmployeeTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid employee_type_id is required', null);
    }

    const result = await db.query('SELECT * FROM employee_type_master WHERE employee_type_id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Employee type not found', null);
    }
    return successResponse(res, 200, 'Employee type fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch employee type');
  }
};

const getAllEmployeeTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active);

    const query = `SELECT * FROM employee_type_master${whereClause} ORDER BY employee_type_id ASC`;
    const result = await db.query(query);
    return successResponse(res, 200, 'Employee types fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch employee types');
  }
};

const getPaginatedEmployeeTypes = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active);

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM employee_type_master${whereClause}`);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT * FROM employee_type_master${whereClause}
      ORDER BY employee_type_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Employee types fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated employee types');
  }
};

const updateEmployeeType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid employee_type_id is required', null);
    }

    const existing = await db.query('SELECT * FROM employee_type_master WHERE employee_type_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Employee type not found', null);
    }

    const { employee_type_name, updated_by, is_active } = req.body;

    if (employee_type_name !== undefined && employee_type_name.trim() === '') {
      return errorResponse(res, 400, 'employee_type_name cannot be empty', null);
    }

    const query = `
      UPDATE employee_type_master
      SET employee_type_name = COALESCE($1, employee_type_name),
          updated_by = COALESCE($2, updated_by),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE employee_type_id = $4
      RETURNING *
    `;
    const values = [
      employee_type_name !== undefined ? employee_type_name : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Employee type updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update employee type');
  }
};

const deleteEmployeeType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid employee_type_id is required', null);
    }

    const existing = await db.query('SELECT * FROM employee_type_master WHERE employee_type_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Employee type not found', null);
    }

    const { updated_by } = req.body;
    const query = `
      UPDATE employee_type_master
      SET is_active = FALSE, updated_by = COALESCE($1, updated_by), updated_at = CURRENT_TIMESTAMP
      WHERE employee_type_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [updated_by || null, id]);
    return successResponse(res, 200, 'Employee type deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete employee type');
  }
};

module.exports = {
  createEmployeeType,
  getEmployeeTypeById,
  getAllEmployeeTypes,
  getPaginatedEmployeeTypes,
  updateEmployeeType,
  deleteEmployeeType,
};