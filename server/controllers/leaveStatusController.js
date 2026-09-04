const { db } = require("../db/connectDB");

const {
  successResponse,
  errorResponse,
  paginatedResponse,
  handleDbError
} = require("../utils/response");

const {
  getPaginationParams
} = require("../utils/pagination");


// ============================================================
// CREATE LEAVE STATUS
// ============================================================

const createLeaveStatus = async (req, res) => {
  try {

    const {
      leave_status_name,
      created_by
    } = req.body;


    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (
      !leave_status_name ||
      leave_status_name.trim() === ""
    ) {
      return errorResponse(
        res,
        400,
        "leave_status_name is required",
        null
      );
    }


    // --------------------------------------------------------
    // Check duplicate status
    // --------------------------------------------------------

    const duplicateQuery = `
      SELECT ls_leave_status_id
      FROM public.leave_status
      WHERE UPPER(ls_leave_status_name) = UPPER($1)
    `;

    const duplicateResult = await db.query(
      duplicateQuery,
      [leave_status_name.trim()]
    );


    if (duplicateResult.rows.length > 0) {
      return errorResponse(
        res,
        409,
        "Leave status already exists",
        null
      );
    }


    // --------------------------------------------------------
    // Insert
    // --------------------------------------------------------

    const query = `
      INSERT INTO public.leave_status
      (
        ls_leave_status_name,
        ls_is_active,
        ls_created_at,
        ls_created_by
      )
      VALUES
      (
        $1,
        TRUE,
        CURRENT_TIMESTAMP,
        $2
      )
      RETURNING *
    `;


    const result = await db.query(
      query,
      [
        leave_status_name.trim().toUpperCase(),
        created_by || null
      ]
    );


    return successResponse(
      res,
      201,
      "Leave status created successfully",
      result.rows[0]
    );

  } catch (error) {

    return handleDbError(
      res,
      error,
      "Failed to create leave status"
    );

  }
};


// ============================================================
// GET LEAVE STATUS BY ID
// ============================================================

const getLeaveStatusById = async (req, res) => {
  try {

    const { id } = req.params;


    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid leave_status_id is required",
        null
      );
    }


    const query = `
      SELECT
        ls.*,

        cp.pr_first_name AS created_by_name,

        up.pr_first_name AS updated_by_name

      FROM public.leave_status ls

      LEFT JOIN public.personal cp
        ON cp.pr_id = ls.ls_created_by

      LEFT JOIN public.personal up
        ON up.pr_id = ls.ls_updated_by

      WHERE ls.ls_leave_status_id = $1
    `;


    const result = await db.query(
      query,
      [id]
    );


    if (result.rows.length === 0) {

      return errorResponse(
        res,
        404,
        "Leave status not found",
        null
      );

    }


    return successResponse(
      res,
      200,
      "Leave status fetched successfully",
      result.rows[0]
    );

  } catch (error) {

    return handleDbError(
      res,
      error,
      "Failed to fetch leave status"
    );

  }
};


// ============================================================
// GET ALL LEAVE STATUS
// ============================================================

const getAllLeaveStatuses = async (req, res) => {
  try {

    const {
      is_active
    } = req.query;


    let query = `
      SELECT
        ls.*,

        cp.pr_first_name AS created_by_name,

        up.pr_first_name AS updated_by_name

      FROM public.leave_status ls

      LEFT JOIN public.personal cp
        ON cp.pr_id = ls.ls_created_by

      LEFT JOIN public.personal up
        ON up.pr_id = ls.ls_updated_by
    `;


    const values = [];


    // --------------------------------------------------------
    // Active filter
    // --------------------------------------------------------

    if (
      is_active !== undefined
    ) {

      if (
        is_active !== "true" &&
        is_active !== "false"
      ) {
        return errorResponse(
          res,
          400,
          "is_active must be true or false",
          null
        );
      }


      query += `
        WHERE ls.ls_is_active = $1
      `;


      values.push(
        is_active === "true"
      );

    }


    query += `
      ORDER BY ls.ls_leave_status_id ASC
    `;


    const result = await db.query(
      query,
      values
    );


    return successResponse(
      res,
      200,
      "Leave statuses fetched successfully",
      result.rows
    );

  } catch (error) {

    return handleDbError(
      res,
      error,
      "Failed to fetch leave statuses"
    );

  }
};


// ============================================================
// GET PAGINATED LEAVE STATUS
// ============================================================

const getPaginatedLeaveStatuses = async (req, res) => {
  try {

    const {
      is_active
    } = req.query;


    const {
      page,
      limit,
      offset
    } = getPaginationParams(
      req.query
    );


    let whereClause = "";

    const values = [];


    // --------------------------------------------------------
    // Active filter
    // --------------------------------------------------------

    if (
      is_active !== undefined
    ) {

      if (
        is_active !== "true" &&
        is_active !== "false"
      ) {
        return errorResponse(
          res,
          400,
          "is_active must be true or false",
          null
        );
      }


      whereClause = `
        WHERE ls.ls_is_active = $1
      `;


      values.push(
        is_active === "true"
      );

    }


    // --------------------------------------------------------
    // Count
    // --------------------------------------------------------

    const countQuery = `
      SELECT
        COUNT(*)::int AS total

      FROM public.leave_status ls

      ${whereClause}
    `;


    const countResult = await db.query(
      countQuery,
      values
    );


    const total_records =
      countResult.rows[0].total;


    const total_pages =
      Math.ceil(
        total_records / limit
      ) || 0;


    // --------------------------------------------------------
    // Data
    // --------------------------------------------------------

    const dataQuery = `
      SELECT
        ls.*,

        cp.pr_first_name AS created_by_name,

        up.pr_first_name AS updated_by_name

      FROM public.leave_status ls

      LEFT JOIN public.personal cp
        ON cp.pr_id = ls.ls_created_by

      LEFT JOIN public.personal up
        ON up.pr_id = ls.ls_updated_by

      ${whereClause}

      ORDER BY ls.ls_leave_status_id ASC

      LIMIT $${values.length + 1}

      OFFSET $${values.length + 2}
    `;


    const dataValues = [
      ...values,
      limit,
      offset
    ];


    const dataResult = await db.query(
      dataQuery,
      dataValues
    );


    return paginatedResponse(
      res,
      200,
      "Leave statuses fetched successfully",
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
      "Failed to fetch paginated leave statuses"
    );

  }
};


// ============================================================
// UPDATE LEAVE STATUS
// ============================================================

const updateLeaveStatus = async (req, res) => {
  try {

    const { id } = req.params;


    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid leave_status_id is required",
        null
      );
    }


    // --------------------------------------------------------
    // Check existing record
    // --------------------------------------------------------

    const existingQuery = `
      SELECT *
      FROM public.leave_status
      WHERE ls_leave_status_id = $1
    `;


    const existingResult = await db.query(
      existingQuery,
      [id]
    );


    if (existingResult.rows.length === 0) {

      return errorResponse(
        res,
        404,
        "Leave status not found",
        null
      );

    }


    const {
      leave_status_name,
      is_active,
      updated_by
    } = req.body;


    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (
      leave_status_name !== undefined &&
      leave_status_name.trim() === ""
    ) {
      return errorResponse(
        res,
        400,
        "leave_status_name cannot be empty",
        null
      );
    }


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


    // --------------------------------------------------------
    // Check duplicate name
    // --------------------------------------------------------

    if (
      leave_status_name !== undefined
    ) {

      const duplicateQuery = `
        SELECT ls_leave_status_id

        FROM public.leave_status

        WHERE
          UPPER(ls_leave_status_name)
          =
          UPPER($1)

        AND ls_leave_status_id <> $2
      `;


      const duplicateResult =
        await db.query(
          duplicateQuery,
          [
            leave_status_name.trim(),
            id
          ]
        );


      if (
        duplicateResult.rows.length > 0
      ) {

        return errorResponse(
          res,
          409,
          "Leave status already exists",
          null
        );

      }

    }


    // --------------------------------------------------------
    // Update
    // --------------------------------------------------------

    const query = `
      UPDATE public.leave_status

      SET

        ls_leave_status_name =
          COALESCE($1, ls_leave_status_name),

        ls_is_active =
          COALESCE($2, ls_is_active),

        ls_updated_by =
          COALESCE($3, ls_updated_by),

        ls_updated_at =
          CURRENT_TIMESTAMP

      WHERE ls_leave_status_id = $4

      RETURNING *
    `;


    const values = [

      leave_status_name !== undefined
        ? leave_status_name.trim().toUpperCase()
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
      "Leave status updated successfully",
      result.rows[0]
    );

  } catch (error) {

    return handleDbError(
      res,
      error,
      "Failed to update leave status"
    );

  }
};


// ============================================================
// ACTIVATE / DEACTIVATE LEAVE STATUS
// ============================================================

const deleteLeaveStatus = async (req, res) => {
  try {

    const { id } = req.params;


    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid leave_status_id is required",
        null
      );
    }


    // --------------------------------------------------------
    // Check existing
    // --------------------------------------------------------

    const existingQuery = `
      SELECT ls_leave_status_id
      FROM public.leave_status
      WHERE ls_leave_status_id = $1
    `;


    const existingResult = await db.query(
      existingQuery,
      [id]
    );


    if (existingResult.rows.length === 0) {

      return errorResponse(
        res,
        404,
        "Leave status not found",
        null
      );

    }


    const {
      is_active,
      updated_by
    } = req.body;


    // --------------------------------------------------------
    // Validate
    // --------------------------------------------------------

    if (
      typeof is_active !== "boolean"
    ) {
      return errorResponse(
        res,
        400,
        "is_active must be true or false",
        null
      );
    }


    // --------------------------------------------------------
    // Update status
    // --------------------------------------------------------

    const query = `
      UPDATE public.leave_status

      SET

        ls_is_active = $1,

        ls_updated_by =
          COALESCE($2, ls_updated_by),

        ls_updated_at =
          CURRENT_TIMESTAMP

      WHERE ls_leave_status_id = $3

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
      `Leave status ${
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
      "Failed to update leave status"
    );

  }
};


module.exports = {

  createLeaveStatus,

  getLeaveStatusById,

  getAllLeaveStatuses,

  getPaginatedLeaveStatuses,

  updateLeaveStatus,

  deleteLeaveStatus

};