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
      from_date,
      to_date,
      emptype,
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

    // Validate emptype
    if (
      emptype === undefined ||
      emptype === null ||
      !Number.isInteger(Number(emptype))
    ) {
      return errorResponse(
        res,
        400,
        "valid emptype is required",
        null
      );
    }

    // Validate from_date and to_date
    if (from_date && to_date && new Date(to_date) < new Date(from_date)) {
      return errorResponse(
        res,
        400,
        "to_date must be greater than or equal to from_date",
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
        lt_from_date,
        lt_to_date,
        lt_emptype,
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
        $5,
        $6,
        $7,
        TRUE,
        CURRENT_TIMESTAMP,
        $8
      )
      RETURNING *
    `;

    const result = await db.query(query, [
      leave_type_code.trim().toUpperCase(),
      leave_type_name.trim(),
      Number(total_days_per_year),
      is_paid !== undefined ? is_paid : true,
      from_date || null,
      to_date || null,
      Number(emptype),
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
    const { pr_id, is_active } = req.query;

    if (!pr_id) {
      return res.status(400).json({
        success: false,
        message: "Pr_Id is required"
      });
    }

    const employeeResult = await db.query(
      `
      SELECT
        or_employee_type_id
      FROM public.organizations
      WHERE pr_id = $1
        AND COALESCE(or_is_active, TRUE) = TRUE
        AND or_employee_type_id IS NOT NULL
      ORDER BY or_id DESC
      LIMIT 1
      `,
      [pr_id]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Active organization information not found for Pr_Id ${pr_id}`
      });
    }

    const employeeTypeId =
      employeeResult.rows[0].or_employee_type_id;

    let activeCondition = "lt_is_active = TRUE";

    if (is_active !== undefined) {
      const activeValue = String(is_active).toLowerCase();

      if (activeValue === "true") {
        activeCondition = "lt_is_active = TRUE";
      } else if (activeValue === "false") {
        activeCondition = "lt_is_active = FALSE";
      } else {
        return res.status(400).json({
          success: false,
          message: "is_active must be true or false"
        });
      }
    }

    const result = await db.query(
      `
      SELECT
        lt_leave_type_id,
        lt_leave_type_code,
        lt_leave_type_name,
        lt_total_days_per_year,
        lt_is_paid,
        lt_from_date,
        lt_to_date,
        lt_emptype,
        lt_is_active,
        lt_created_at,
        lt_updated_at,
        lt_created_by,
        lt_updated_by
      FROM public.leave_types
      WHERE lt_emptype = $1
      AND lt_leave_type_code = 'PL' Or lt_leave_type_code = 'LWP'
        AND ${activeCondition}
      ORDER BY lt_leave_type_id ASC
      `,
      [employeeTypeId]
    );

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
      from_date,
      to_date,
      emptype,
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

    // Validate emptype
    if (
      emptype !== undefined &&
      !Number.isInteger(Number(emptype))
    ) {
      return errorResponse(
        res,
        400,
        "emptype must be a valid integer",
        null
      );
    }

    // Validate from_date and to_date
    if (from_date && to_date && new Date(to_date) < new Date(from_date)) {
      return errorResponse(
        res,
        400,
        "to_date must be greater than or equal to from_date",
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

        lt_from_date =
          COALESCE($5, lt_from_date),

        lt_to_date =
          COALESCE($6, lt_to_date),

        lt_emptype =
          COALESCE($7, lt_emptype),

        lt_is_active =
          COALESCE($8, lt_is_active),

        lt_updated_by =
          COALESCE($9, lt_updated_by),

        lt_updated_at =
          CURRENT_TIMESTAMP

      WHERE lt_leave_type_id = $10

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

      from_date !== undefined
        ? from_date
        : null,

      to_date !== undefined
        ? to_date
        : null,

      emptype !== undefined
        ? Number(emptype)
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