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


const createHolidayType = async (req, res) => {
  try {
    const {
      holiday_type_name,
      remarks,
      created_by,
    } = req.body;

    // Validation
    if (
      !holiday_type_name ||
      holiday_type_name.trim() === ""
    ) {
      return errorResponse(
        res,
        400,
        "holiday_type_name is required",
        null
      );
    }

    const query = `
      INSERT INTO holiday_type_master
      (
        holiday_type_name,
        remarks,
        created_by,
        created_at,
        is_active
      )
      VALUES
      (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP,
        TRUE
      )
      RETURNING *
    `;

    const values = [
      holiday_type_name.trim(),
      remarks || null,
      created_by || null,
    ];

    const result = await db.query(query, values);

    return successResponse(
      res,
      201,
      "Holiday Type created successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to create holiday type"
    );
  }
};


const getHolidayTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid holiday_type_id is required",
        null
      );
    }

    const query = `
      SELECT *
      FROM holiday_type_master
      WHERE holiday_type_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Holiday Type not found",
        null
      );
    }

    return successResponse(
      res,
      200,
      "Holiday Type fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch holiday type"
    );
  }
};


const getAllHolidayTypes = async (req, res) => {
  try {
    const { is_active } = req.query;

    const whereClause = buildIsActiveClause(is_active);

    const query = `
      SELECT *
      FROM holiday_type_master
      ${whereClause}
      ORDER BY holiday_type_id ASC
    `;

    const result = await db.query(query);

    return successResponse(
      res,
      200,
      "Holiday Types fetched successfully",
      result.rows
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch holiday types"
    );
  }
};


const getPaginatedHolidayTypes = async (req, res) => {
  try {
    const { is_active } = req.query;

    const {
      page,
      limit,
      offset,
    } = getPaginationParams(req.query);

    const whereClause = buildIsActiveClause(is_active);

    // Get total records
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM holiday_type_master
      ${whereClause}
    `;

    const countResult = await db.query(countQuery);

    const total_records = countResult.rows[0].total;

    const total_pages =
      Math.ceil(total_records / limit) || 0;

    // Get paginated data
    const dataQuery = `
      SELECT *
      FROM holiday_type_master
      ${whereClause}
      ORDER BY holiday_type_id ASC
      LIMIT $1 OFFSET $2
    `;

    const dataResult = await db.query(
      dataQuery,
      [limit, offset]
    );

    return paginatedResponse(
      res,
      200,
      "Holiday Types fetched successfully",
      dataResult.rows,
      {
        page,
        limit,
        total_records,
        total_pages,
      }
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch paginated holiday types"
    );
  }
};


const updateHolidayType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid holiday_type_id is required",
        null
      );
    }

    // Check existing record
    const existingQuery = `
      SELECT *
      FROM holiday_type_master
      WHERE holiday_type_id = $1
    `;

    const existing = await db.query(
      existingQuery,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Holiday Type not found",
        null
      );
    }

    const {
      holiday_type_name,
      remarks,
      updated_by,
      is_active,
    } = req.body;

    // Validate holiday type name
    if (
      holiday_type_name !== undefined &&
      holiday_type_name.trim() === ""
    ) {
      return errorResponse(
        res,
        400,
        "holiday_type_name cannot be empty",
        null
      );
    }

    const query = `
      UPDATE holiday_type_master
      SET
        holiday_type_name = COALESCE($1, holiday_type_name),
        remarks = COALESCE($2, remarks),
        updated_by = COALESCE($3, updated_by),
        is_active = COALESCE($4, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE holiday_type_id = $5
      RETURNING *
    `;

    const values = [
      holiday_type_name !== undefined
        ? holiday_type_name.trim()
        : null,

      remarks !== undefined
        ? remarks
        : null,

      updated_by !== undefined
        ? updated_by
        : null,

      is_active !== undefined
        ? is_active
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
      "Holiday Type updated successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to update holiday type"
    );
  }
};

const deleteHolidayType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid holiday_type_id is required",
        null
      );
    }

    // Check existing record
    const existingQuery = `
      SELECT *
      FROM holiday_type_master
      WHERE holiday_type_id = $1
    `;

    const existing = await db.query(
      existingQuery,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Holiday Type not found",
        null
      );
    }

    const { updated_by } = req.body;

    // Soft delete
    const query = `
      UPDATE holiday_type_master
      SET
        is_active = FALSE,
        updated_by = COALESCE($1, updated_by),
        updated_at = CURRENT_TIMESTAMP
      WHERE holiday_type_id = $2
      RETURNING *
    `;

    const result = await db.query(
      query,
      [
        updated_by || null,
        id,
      ]
    );

    return successResponse(
      res,
      200,
      "Holiday Type deleted successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to delete holiday type"
    );
  }
};


module.exports = {
  createHolidayType,
  getHolidayTypeById,
  getAllHolidayTypes,
  getPaginatedHolidayTypes,
  updateHolidayType,
  deleteHolidayType,
};