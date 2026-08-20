const { db } = require("../db/connectDB");

const {
  successResponse,
  errorResponse,
  paginatedResponse,
  handleDbError,    
} = require("../utils/response");

const {
  getPaginationParams,
  buildIsActiveClause,
} = require("../utils/pagination");


const createHoliday = async (req, res) => {
  try {
    const {
      holiday_date,
      holiday_name,
      is_paid,
      remarks,
      holiday_type_id,
    } = req.body;

    
    if (!holiday_date) {
      return errorResponse(
        res,
        400,
        "holiday_date is required",
        null
      );
    }

    if (!holiday_name || holiday_name.trim() === "") {
      return errorResponse(
        res,
        400,
        "holiday_name is required",
        null
      );
    }

    if (!holiday_type_id) {
      return errorResponse(
        res,
        400,
        "holiday_type_id is required",
        null
      );
    }

    
    const holidayType = await db.query(
      `
      SELECT holiday_type_id
      FROM holiday_type_master
      WHERE holiday_type_id = $1
        AND is_active = TRUE
      `,
      [holiday_type_id]
    );

    if (holidayType.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Invalid or inactive holiday_type_id",
        null
      );
    }

    
    const query = `
      INSERT INTO holidays
      (
        holiday_date,
        holiday_name,
        is_paid,
        is_active,
        remarks,
        created_at,
        holiday_type_id
      )
      VALUES
      (
        $1,
        $2,
        COALESCE($3, TRUE),
        TRUE,
        $4,
        CURRENT_TIMESTAMP,
        $5
      )
      RETURNING *
    `;

    const values = [
      holiday_date,
      holiday_name.trim(),
      is_paid !== undefined ? is_paid : null,
      remarks || null,
      holiday_type_id,
    ];

    const result = await db.query(query, values);

    return successResponse(
      res,
      201,
      "Holiday created successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to create holiday"
    );
  }
};


const getHolidayById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid holiday_id is required",
        null
      );
    }

    const query = `
      SELECT
        h.*,
        ht.holiday_type_name
      FROM holidays h
      LEFT JOIN holiday_type_master ht
        ON h.holiday_type_id = ht.holiday_type_id
      WHERE h.holiday_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Holiday not found",
        null
      );
    }

    return successResponse(
      res,
      200,
      "Holiday fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch holiday"
    );
  }
};


const getAllHolidays = async (req, res) => {
  try {
    const { is_active } = req.query;

    const whereClause = buildIsActiveClause(
      is_active,
      "h.is_active"
    );

    const query = `
      SELECT
        h.*,
        ht.holiday_type_name
      FROM holidays h
      LEFT JOIN holiday_type_master ht
        ON h.holiday_type_id = ht.holiday_type_id
      ${whereClause}
      ORDER BY h.holiday_date ASC, h.holiday_id ASC
    `;

    const result = await db.query(query);

    return successResponse(
      res,
      200,
      "Holidays fetched successfully",
      result.rows
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch holidays"
    );
  }
};


const getPaginatedHolidays = async (req, res) => {
  try {
    const { is_active } = req.query;

    const {
      page,
      limit,
      offset,
    } = getPaginationParams(req.query);

    const whereClause = buildIsActiveClause(is_active);

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM holidays h
      ${whereClause}
    `;

    const countResult = await db.query(countQuery);

    const total_records = countResult.rows[0].total;

    const total_pages =
      Math.ceil(total_records / limit) || 0;

    const dataQuery = `
      SELECT
        h.*,
        ht.holiday_type_name
      FROM holidays h
      LEFT JOIN holiday_type_master ht
        ON h.holiday_type_id = ht.holiday_type_id
      ${whereClause}
      ORDER BY h.holiday_date ASC, h.holiday_id ASC
      LIMIT $1 OFFSET $2
    `;

    const dataResult = await db.query(
      dataQuery,
      [limit, offset]
    );

    return paginatedResponse(
      res,
      200,
      "Holidays fetched successfully",
      dataResult.rows,
      {
        page,
        limit,
        total_records,
        total_pages,
      }
    );
  } catch (error) {
    console.error("getPaginatedHolidays error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch paginated holidays"
    );
  }
};


const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid holiday_id is required",
        null
      );
    }

   
    const existing = await db.query(
      `
      SELECT *
      FROM holidays
      WHERE holiday_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Holiday not found",
        null
      );
    }

    const {
      holiday_date,
      holiday_name,
      is_paid,
      is_active,
      remarks,
      holiday_type_id,
    } = req.body;

   
    if (
      holiday_name !== undefined &&
      holiday_name.trim() === ""
    ) {
      return errorResponse(
        res,
        400,
        "holiday_name cannot be empty",
        null
      );
    }

    
    if (holiday_type_id !== undefined) {
      const holidayType = await db.query(
        `
        SELECT holiday_type_id
        FROM holiday_type_master
        WHERE holiday_type_id = $1
          AND is_active = TRUE
        `,
        [holiday_type_id]
      );

      if (holidayType.rows.length === 0) {
        return errorResponse(
          res,
          400,
          "Invalid or inactive holiday_type_id",
          null
        );
      }
    }

  
    const query = `
      UPDATE holidays
      SET
        holiday_date = COALESCE($1, holiday_date),
        holiday_name = COALESCE($2, holiday_name),
        is_paid = COALESCE($3, is_paid),
        is_active = COALESCE($4, is_active),
        remarks = COALESCE($5, remarks),
        holiday_type_id = COALESCE($6, holiday_type_id)
      WHERE holiday_id = $7
      RETURNING *
    `;

    const values = [
      holiday_date !== undefined
        ? holiday_date
        : null,

      holiday_name !== undefined
        ? holiday_name.trim()
        : null,

      is_paid !== undefined
        ? is_paid
        : null,

      is_active !== undefined
        ? is_active
        : null,

      remarks !== undefined
        ? remarks
        : null,

      holiday_type_id !== undefined
        ? holiday_type_id
        : null,

      id,
    ];

    const result = await db.query(
      query,
      values
    );

    return successResponse(
      res,
      200,
      "Holiday updated successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to update holiday"
    );
  }
};


const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid holiday_id is required",
        null
      );
    }

   
    const existing = await db.query(
      `
      SELECT *
      FROM holidays
      WHERE holiday_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Holiday not found",
        null
      );
    }

   
    const query = `
      UPDATE holidays
      SET is_active = FALSE
      WHERE holiday_id = $1
      RETURNING *
    `;

    const result = await db.query(
      query,
      [id]
    );

    return successResponse(
      res,
      200,
      "Holiday deleted successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to delete holiday"
    );
  }
};


module.exports = {
  createHoliday,
  getHolidayById,
  getAllHolidays,
  getPaginatedHolidays,
  updateHoliday,
  deleteHoliday,
};