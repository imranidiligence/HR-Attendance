const { db } = require("../db/connectDB");

// -------------------- CREATE --------------------
const createPunchType = async (req, res) => {
  const { name, created_by, is_active } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'name is required',
    });
  }

  try {
    const query = `
      INSERT INTO public.punch_type
        (name, created_by, updated_by, is_active)
      VALUES ($1, $2, $2, $3)
      RETURNING *;
    `;
    const values = [name, created_by || null, is_active !== undefined ? is_active : true];

    const result = await db.query(query, values);

    return res.status(201).json({
      success: true,
      message: 'Punch type created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid created_by: no matching record in personal table',
      });
    }
    console.error('createPunchType error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- GET BY ID --------------------
const getPunchTypeById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `SELECT * FROM public.punch_type WHERE id = $1;`;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getPunchTypeById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- GET ALL (no pagination, simple list) --------------------
// Supports optional ?is_active=true/false filter
const getAllPunchTypes = async (req, res) => {
  const { is_active } = req.query;

  try {
    let query = `SELECT * FROM public.punch_type`;
    const values = [];

    if (is_active !== undefined) {
      query += ` WHERE is_active = $1`;
      values.push(is_active === 'true');
    }

    query += ` ORDER BY id ASC;`;

    const result = await db.query(query, values);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('getAllPunchTypes error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- GET PAGINATED --------------------
const getPaginatedPunchTypes = async (req, res) => {
  try {
    let { page = 1, limit = 10, name, is_active, sort_by, sort_order } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    const allowedSortColumns = ['id', 'name', 'created_at', 'updated_at', 'is_active'];
    const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'id';
    const sortDirection = sort_order && sort_order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = [];
    const values = [];
    let idx = 1;

    if (name) {
      conditions.push(`name ILIKE $${idx++}`);
      values.push(`%${name}%`);
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${idx++}`);
      values.push(is_active === 'true');
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*)::int AS total FROM public.punch_type ${whereClause};`;
    const countResult = await db.query(countQuery, values);
    const totalRecords = countResult.rows[0].total;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const dataQuery = `
      SELECT * FROM public.punch_type
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const dataValues = [...values, limit, offset];
    const dataResult = await db.query(dataQuery, dataValues);

    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('getPaginatedPunchTypes error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- UPDATE --------------------
const updatePunchType = async (req, res) => {
  const { id } = req.params;
  const { name, updated_by, is_active } = req.body;

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    const fieldMap = { name, updated_by, is_active };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id);

    const query = `
      UPDATE public.punch_type
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Punch type updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid updated_by: no matching record in personal table',
      });
    }
    console.error('updatePunchType error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- TOGGLE / SET ACTIVE STATUS (soft delete / restore) --------------------
const setPunchTypeActiveStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active, updated_by } = req.body;

  if (is_active === undefined) {
    return res.status(400).json({ success: false, message: 'is_active is required (true/false)' });
  }

  try {
    const query = `
      UPDATE public.punch_type
      SET is_active = $1,
          updated_by = COALESCE($2, updated_by),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const result = await db.query(query, [is_active, updated_by || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Punch type ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid updated_by: no matching record in personal table',
      });
    }
    console.error('setPunchTypeActiveStatus error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- DELETE (hard delete) --------------------
const deletePunchType = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `DELETE FROM public.punch_type WHERE id = $1 RETURNING *;`;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Punch type deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete: punch_type is referenced by existing activity_log_mobile records. Consider deactivating instead.',
      });
    }
    console.error('deletePunchType error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  createPunchType,
  getPunchTypeById,
  getAllPunchTypes,
  getPaginatedPunchTypes,
  updatePunchType,
  setPunchTypeActiveStatus,
  deletePunchType,
};