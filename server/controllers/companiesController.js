const { db } = require("../db/connectDB");
const { successResponse, errorResponse, paginatedResponse, handleDbError } = require('../utils/response');
const { getPaginationParams, buildIsActiveClause } = require('../utils/pagination');

const createCompany = async (req, res) => {
  try {
    const {
      cpt_name,
      cpt_email,
      cpt_contact_number,
      cpt_website,
      cpt_logopath,
      cpt_city_id,
      cpt_state_id,
      cpt_country_id,
      cpt_created_by
    } = req.body;

    if (!cpt_name || cpt_name.trim() === '') {
      return errorResponse(res, 400, 'cpt_name is required', null);
    }

    const query = `
      INSERT INTO companies_master (
        cpt_name, cpt_email, cpt_contact_number, cpt_website, 
        cpt_logopath, cpt_city_id, cpt_state_id, cpt_country_id,
        cpt_created_by, cpt_created_at, cpt_is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, TRUE)
      RETURNING *
    `;
    const result = await db.query(query, [
      cpt_name,
      cpt_email || null,
      cpt_contact_number || null,
      cpt_website || null,
      cpt_logopath || null,
      cpt_city_id || null,
      cpt_state_id || null,
      cpt_country_id || null,
      cpt_created_by || null
    ]);
    return successResponse(res, 201, 'Company created successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to create company');
  }
};

const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid company id is required', null);
    }

    const query = `
      SELECT 
        cm.*,
        cm.cpt_created_by,
        cm.cpt_updated_by,
        CONCAT(cr.pr_first_name, ' ', cr.pr_last_name) AS created_by_name,
        CONCAT(ur.pr_first_name, ' ', ur.pr_last_name) AS updated_by_name,
        cm2.city_name,
        sm.state_name,
        ctry.country_name
      FROM companies_master cm
      LEFT JOIN personal cr ON cm.cpt_created_by = cr.pr_id
      LEFT JOIN personal ur ON cm.cpt_updated_by = ur.pr_id
      LEFT JOIN city_master cm2 ON cm.cpt_city_id = cm2.city_id
      LEFT JOIN state_master sm ON cm.cpt_state_id = sm.state_id
      LEFT JOIN country_master ctry ON cm.cpt_country_id = ctry.country_id
      WHERE cm.cpt_id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Company not found', null);
    }
    return successResponse(res, 200, 'Company fetched successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch company');
  }
};

const getAllCompanies = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = buildIsActiveClause(is_active, 'cpt_is_active');

    const query = `
      SELECT 
        cm.*,
        cm.cpt_created_by,
        cm.cpt_updated_by,
        CONCAT(cr.pr_first_name, ' ', cr.pr_last_name) AS created_by_name,
        CONCAT(ur.pr_first_name, ' ', ur.pr_last_name) AS updated_by_name,
        cm2.city_name,
        sm.state_name,
        ctry.country_name
      FROM companies_master cm
      LEFT JOIN personal cr ON cm.cpt_created_by = cr.pr_id
      LEFT JOIN personal ur ON cm.cpt_updated_by = ur.pr_id
      LEFT JOIN city_master cm2 ON cm.cpt_city_id = cm2.city_id
      LEFT JOIN state_master sm ON cm.cpt_state_id = sm.state_id
      LEFT JOIN country_master ctry ON cm.cpt_country_id = ctry.country_id
      ${whereClause}
      ORDER BY cm.cpt_id ASC
    `;
    const result = await db.query(query);
    return successResponse(res, 200, 'Companies fetched successfully', result.rows);
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch companies');
  }
};

const getPaginatedCompanies = async (req, res) => {
  try {
    const { is_active } = req.query;
    const { page, limit, offset } = getPaginationParams(req.query);
    const whereClause = buildIsActiveClause(is_active, 'cpt_is_active');

    const countQuery = `SELECT COUNT(*)::int AS total FROM companies_master${whereClause}`;
    const countResult = await db.query(countQuery);
    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT 
        cm.*,
        cm.cpt_created_by,
        cm.cpt_updated_by,
        CONCAT(cr.pr_first_name, ' ', cr.pr_last_name) AS created_by_name,
        CONCAT(ur.pr_first_name, ' ', ur.pr_last_name) AS updated_by_name,
        cm2.city_name,
        sm.state_name,
        ctry.country_name
      FROM companies_master cm
      LEFT JOIN personal cr ON cm.cpt_created_by = cr.pr_id
      LEFT JOIN personal ur ON cm.cpt_updated_by = ur.pr_id
      LEFT JOIN city_master cm2 ON cm.cpt_city_id = cm2.city_id
      LEFT JOIN state_master sm ON cm.cpt_state_id = sm.state_id
      LEFT JOIN country_master ctry ON cm.cpt_country_id = ctry.country_id
      ${whereClause}
      ORDER BY cm.cpt_id ASC
      LIMIT $1 OFFSET $2
    `;
    const dataResult = await db.query(dataQuery, [limit, offset]);

    return paginatedResponse(res, 200, 'Companies fetched successfully', dataResult.rows, {
      page,
      limit,
      total_records,
      total_pages,
    });
  } catch (error) {
    return handleDbError(res, error, 'Failed to fetch paginated companies');
  }
};

const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid company id is required', null);
    }

    const existing = await db.query('SELECT * FROM companies_master WHERE cpt_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Company not found', null);
    }

    const {
      cpt_name,
      cpt_email,
      cpt_contact_number,
      cpt_website,
      cpt_logopath,
      cpt_city_id,
      cpt_state_id,
      cpt_country_id,
      cpt_is_active,
      cpt_updated_by
    } = req.body;

    if (cpt_name !== undefined && cpt_name.trim() === '') {
      return errorResponse(res, 400, 'cpt_name cannot be empty', null);
    }

    const query = `
      UPDATE companies_master
      SET 
        cpt_name = COALESCE($1, cpt_name),
        cpt_email = COALESCE($2, cpt_email),
        cpt_contact_number = COALESCE($3, cpt_contact_number),
        cpt_website = COALESCE($4, cpt_website),
        cpt_logopath = COALESCE($5, cpt_logopath),
        cpt_city_id = COALESCE($6, cpt_city_id),
        cpt_state_id = COALESCE($7, cpt_state_id),
        cpt_country_id = COALESCE($8, cpt_country_id),
        cpt_is_active = COALESCE($9, cpt_is_active),
        cpt_updated_by = COALESCE($10, cpt_updated_by),
        cpt_updated_at = CURRENT_TIMESTAMP
      WHERE cpt_id = $11
      RETURNING *
    `;
    const values = [
      cpt_name !== undefined ? cpt_name : null,
      cpt_email !== undefined ? cpt_email : null,
      cpt_contact_number !== undefined ? cpt_contact_number : null,
      cpt_website !== undefined ? cpt_website : null,
      cpt_logopath !== undefined ? cpt_logopath : null,
      cpt_city_id !== undefined ? cpt_city_id : null,
      cpt_state_id !== undefined ? cpt_state_id : null,
      cpt_country_id !== undefined ? cpt_country_id : null,
      cpt_is_active !== undefined ? cpt_is_active : null,
      cpt_updated_by !== undefined ? cpt_updated_by : null,
      id,
    ];

    const result = await db.query(query, values);
    return successResponse(res, 200, 'Company updated successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to update company');
  }
};

const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return errorResponse(res, 400, 'Valid company id is required', null);
    }

    const existing = await db.query('SELECT * FROM companies_master WHERE cpt_id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Company not found', null);
    }

    const { cpt_updated_by } = req.body;
    const query = `
      UPDATE companies_master
      SET 
        cpt_is_active = FALSE, 
        cpt_updated_by = COALESCE($1, cpt_updated_by), 
        cpt_updated_at = CURRENT_TIMESTAMP
      WHERE cpt_id = $2
      RETURNING *
    `;
    const result = await db.query(query, [cpt_updated_by || null, id]);
    return successResponse(res, 200, 'Company deleted successfully', result.rows[0]);
  } catch (error) {
    return handleDbError(res, error, 'Failed to delete company');
  }
};

module.exports = {
  createCompany,
  getCompanyById,
  getAllCompanies,
  getPaginatedCompanies,
  updateCompany,
  deleteCompany,
};