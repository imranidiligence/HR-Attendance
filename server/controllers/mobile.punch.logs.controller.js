const { db } = require("../db/connectDB");

// -------------------- CREATE --------------------
const createActivityLog = async (req, res) => {
  const {
    emp_id,
    punch_time,
    device_ip,
    device_sn,
    punch_type,
    latitude,
    longitude,
  } = req.body;

  if (!emp_id || !punch_time) {
    return res.status(400).json({
      success: false,
      message: 'emp_id and punch_time are required',
    });
  }

  try {
    const query = `
      INSERT INTO public.activity_log_mobile
        (emp_id, punch_time, device_ip, device_sn, punch_type, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      emp_id,
      punch_time,
      device_ip || null,
      device_sn || null,
      punch_type || null,
      latitude || null,
      longitude || null,
    ];

    const result = await db.query(query, values);

    return res.status(201).json({
      success: true,
      message: 'Activity log created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      // unique_violation (unique_emp_punch_time)
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry: emp_id + punch_time already exists',
      });
    }
    if (error.code === '23503') {
      // foreign_key_violation (punch_type)
      return res.status(400).json({
        success: false,
        message: 'Invalid punch_type: no matching record in punch_type table',
      });
    }
    console.error('createActivityLog error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- GET BY ID --------------------
const getActivityLogById = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `SELECT * FROM public.activity_log_mobile WHERE id = $1;`;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getActivityLogById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- GET ALL (no pagination, simple list) --------------------
const getAllActivityLogs = async (req, res) => {
  try {
    const query = `SELECT * FROM public.activity_log_mobile ORDER BY id DESC;`;
    const result = await db.query(query);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('getAllActivityLogs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- GET PAGINATED --------------------
const getPaginatedActivityLogs = async (req, res) => {
  try {
    let { page = 1, limit = 10, emp_id, punch_type, from_date, to_date, sort_by, sort_order } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100; // safety cap

    const offset = (page - 1) * limit;

    // Whitelist sortable columns to prevent SQL injection via sort_by
    const allowedSortColumns = ['id', 'emp_id', 'punch_time', 'created_at', 'received_time'];
    const sortColumn = allowedSortColumns.includes(sort_by) ? sort_by : 'id';
    const sortDirection = sort_order && sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Build dynamic WHERE clause
    const conditions = [];
    const values = [];
    let idx = 1;

    if (emp_id) {
      conditions.push(`emp_id = $${idx++}`);
      values.push(emp_id);
    }
    if (punch_type) {
      conditions.push(`punch_type = $${idx++}`);
      values.push(punch_type);
    }
    if (from_date) {
      conditions.push(`punch_time >= $${idx++}`);
      values.push(from_date);
    }
    if (to_date) {
      conditions.push(`punch_time <= $${idx++}`);
      values.push(to_date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total records
    const countQuery = `SELECT COUNT(*)::int AS total FROM public.activity_log_mobile ${whereClause};`;
    const countResult = await db.query(countQuery, values);
    const totalRecords = countResult.rows[0].total;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Fetch paginated data
    const dataQuery = `
      SELECT * FROM public.activity_log_mobile
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
    console.error('getPaginatedActivityLogs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- UPDATE --------------------
const updateActivityLog = async (req, res) => {
  const { id } = req.params;
  const {
    emp_id,
    punch_time,
    device_ip,
    device_sn,
    punch_type,
    latitude,
    longitude,
  } = req.body;

  try {
    // Build dynamic SET clause so partial updates work
    const fields = [];
    const values = [];
    let idx = 1;

    const fieldMap = { emp_id, punch_time, device_ip, device_sn, punch_type, latitude, longitude };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    values.push(id);

    const query = `
      UPDATE public.activity_log_mobile
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
      message: 'Activity log updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry: emp_id + punch_time already exists',
      });
    }
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Invalid punch_type: no matching record in punch_type table',
      });
    }
    console.error('updateActivityLog error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// -------------------- DELETE --------------------
const deleteActivityLog = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `DELETE FROM public.activity_log_mobile WHERE id = $1 RETURNING *;`;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Activity log deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('deleteActivityLog error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  createActivityLog,
  getActivityLogById,
  getAllActivityLogs,
  getPaginatedActivityLogs,
  updateActivityLog,
  deleteActivityLog,
};