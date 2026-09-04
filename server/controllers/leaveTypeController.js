const { db } = require("../db/connectDB");
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  handleDbError
} = require("../utils/response");

const {
  getPaginationParams,
  buildIsActiveClause
} = require("../utils/pagination");



const createLeaveType = async (req, res) => {
  try {
    const {
      leave_type_code,
      leave_type_name,
      total_days_per_year,
      is_paid,
      created_by
    } = req.body;

    // Validate leave type code
    if (!leave_type_code || leave_type_code.trim() === "") {
      return errorResponse(
        res,
        400,
        "leave_type_code is required",
        null
      );
    }

    // Validate leave type name
    if (!leave_type_name || leave_type_name.trim() === "") {
      return errorResponse(
        res,
        400,
        "leave_type_name is required",
        null
      );
    }

    // Validate total days
    if (
      total_days_per_year === undefined ||
      total_days_per_year === null
    ) {
      return errorResponse(
        res,
        400,
        "total_days_per_year is required",
        null
      );
    }

    if (
      !Number.isInteger(Number(total_days_per_year)) ||
      Number(total_days_per_year) < 0
    ) {
      return errorResponse(
        res,
        400,
        "total_days_per_year must be a non-negative integer",
        null
      );
    }

    // Validate is_paid
    if (
      is_paid !== undefined &&
      typeof is_paid !== "boolean"
    ) {
      return errorResponse(
        res,
        400,
        "is_paid must be true or false",
        null
      );
    }

    const query = `
      INSERT INTO public.leave_types
      (
        lt_leave_type_code,
        lt_leave_type_name,
        lt_total_days_per_year,
        lt_is_paid,
        lt_is_active,
        lt_created_at,
        lt_created_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        TRUE,
        CURRENT_TIMESTAMP,
        $5
      )
      RETURNING *
    `;

    const result = await db.query(query, [
      leave_type_code.trim().toUpperCase(),
      leave_type_name.trim(),
      Number(total_days_per_year),
      is_paid !== undefined ? is_paid : true,
      created_by || null
    ]);

    return successResponse(
      res,
      201,
      "Leave type created successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to create leave type"
    );
  }
};



const getLeaveTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid leave_type_id is required",
        null
      );
    }

    const query = `
      SELECT
        lt.*,
        cp.pr_first_name AS created_by_name,
        up.pr_first_name AS updated_by_name
      FROM public.leave_types lt
      LEFT JOIN public.personal cp
        ON cp.pr_id = lt.lt_created_by
      LEFT JOIN public.personal up
        ON up.pr_id = lt.lt_updated_by
      WHERE lt.lt_leave_type_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Leave type not found",
        null
      );
    }

    return successResponse(
      res,
      200,
      "Leave type fetched successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch leave type"
    );
  }
};



const getAllLeaveTypes = async (req, res) => {
  try {
    const { is_active } = req.query;

    const whereClause = buildIsActiveClause(
      is_active,
      "lt_is_active"
    );

    const query = `
      SELECT *
      FROM public.leave_types
      ${whereClause}
      ORDER BY lt_leave_type_id ASC
    `;

    const result = await db.query(query);

    return successResponse(
      res,
      200,
      "Leave types fetched successfully",
      result.rows
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch leave types"
    );
  }
};



const getPaginatedLeaveTypes = async (req, res) => {
  try {
    const { is_active } = req.query;

    const {
      page,
      limit,
      offset
    } = getPaginationParams(req.query);

    const whereClause = buildIsActiveClause(
      is_active,
      "lt_is_active"
    );

    // Count
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM public.leave_types
      ${whereClause}
    `;

    const countResult = await db.query(countQuery);

    const total_records = countResult.rows[0].total;

    const total_pages =
      Math.ceil(total_records / limit) || 0;

    // Data
    const dataQuery = `
      SELECT *
      FROM public.leave_types
      ${whereClause}
      ORDER BY lt_leave_type_id ASC
      LIMIT $1
      OFFSET $2
    `;

    const dataResult = await db.query(
      dataQuery,
      [limit, offset]
    );

    return paginatedResponse(
      res,
      200,
      "Leave types fetched successfully",
      dataResult.rows,
      {
        page,
        limit,
        total_records,
        total_pages
      }
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch paginated leave types"
    );
  }
};



const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid leave_type_id is required",
        null
      );
    }

    // Check existing record
    const existing = await db.query(
      `
      SELECT *
      FROM public.leave_types
      WHERE lt_leave_type_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Leave type not found",
        null
      );
    }

    const {
      leave_type_code,
      leave_type_name,
      total_days_per_year,
      is_paid,
      is_active,
      updated_by
    } = req.body;


    // Validate code
    if (
      leave_type_code !== undefined &&
      (!leave_type_code ||
        leave_type_code.trim() === "")
    ) {
      return errorResponse(
        res,
        400,
        "leave_type_code cannot be empty",
        null
      );
    }


    // Validate name
    if (
      leave_type_name !== undefined &&
      (!leave_type_name ||
        leave_type_name.trim() === "")
    ) {
      return errorResponse(
        res,
        400,
        "leave_type_name cannot be empty",
        null
      );
    }


    // Validate total days
    if (total_days_per_year !== undefined) {

      if (
        !Number.isInteger(Number(total_days_per_year)) ||
        Number(total_days_per_year) < 0
      ) {
        return errorResponse(
          res,
          400,
          "total_days_per_year must be a non-negative integer",
          null
        );
      }
    }


    // Validate is_paid
    if (
      is_paid !== undefined &&
      typeof is_paid !== "boolean"
    ) {
      return errorResponse(
        res,
        400,
        "is_paid must be true or false",
        null
      );
    }


    // Validate is_active
    if (
      is_active !== undefined &&
      typeof is_active !== "boolean"
    ) {
      return errorResponse(
        res,
        400,
        "is_active must be true or false",
        null
      );
    }


    const query = `
      UPDATE public.leave_types
      SET
        lt_leave_type_code =
          COALESCE($1, lt_leave_type_code),

        lt_leave_type_name =
          COALESCE($2, lt_leave_type_name),

        lt_total_days_per_year =
          COALESCE($3, lt_total_days_per_year),

        lt_is_paid =
          COALESCE($4, lt_is_paid),

        lt_is_active =
          COALESCE($5, lt_is_active),

        lt_updated_by =
          COALESCE($6, lt_updated_by),

        lt_updated_at =
          CURRENT_TIMESTAMP

      WHERE lt_leave_type_id = $7

      RETURNING *
    `;

    const values = [
      leave_type_code !== undefined
        ? leave_type_code.trim().toUpperCase()
        : null,

      leave_type_name !== undefined
        ? leave_type_name.trim()
        : null,

      total_days_per_year !== undefined
        ? Number(total_days_per_year)
        : null,

      is_paid !== undefined
        ? is_paid
        : null,

      is_active !== undefined
        ? is_active
        : null,

      updated_by !== undefined
        ? updated_by
        : null,

      id
    ];

    const result = await db.query(
      query,
      values
    );

    return successResponse(
      res,
      200,
      "Leave type updated successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to update leave type"
    );
  }
};




const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid leave_type_id is required",
        null
      );
    }

    // Check existing
    const existing = await db.query(
      `
      SELECT lt_leave_type_id
      FROM public.leave_types
      WHERE lt_leave_type_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Leave type not found",
        null
      );
    }

    const {
      is_active,
      updated_by
    } = req.body;

    // Validate is_active
    if (typeof is_active !== "boolean") {
      return errorResponse(
        res,
        400,
        "is_active must be true or false",
        null
      );
    }

    const query = `
      UPDATE public.leave_types
      SET
        lt_is_active = $1,
        lt_updated_by = COALESCE($2, lt_updated_by),
        lt_updated_at = CURRENT_TIMESTAMP
      WHERE lt_leave_type_id = $3
      RETURNING *
    `;

    const result = await db.query(
      query,
      [
        is_active,
        updated_by || null,
        id
      ]
    );

    return successResponse(
      res,
      200,
      `Leave type ${
        is_active
          ? "activated"
          : "deactivated"
      } successfully`,
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to update leave type status"
    );
  }
};




module.exports = {
  createLeaveType,
  getLeaveTypeById,
  getAllLeaveTypes,
  getPaginatedLeaveTypes,
  updateLeaveType,
  deleteLeaveType
};