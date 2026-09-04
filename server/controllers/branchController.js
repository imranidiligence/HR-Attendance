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
// CREATE BRANCH
// ============================================================

const createBranch = async (req, res) => {
  try {
    const {
      branch_company_id,
      branch_name,
      branch_code,
      address_line_1,
      address_line_2,
      country_id,
      state_id,
      city_id,
      postal_code,
      created_by
    } = req.body;

    // --------------------------------------------------------
    // Required field validation
    // --------------------------------------------------------

    if (
      branch_company_id === undefined ||
      branch_company_id === null ||
      branch_company_id === "" ||
      isNaN(branch_company_id)
    ) {
      return errorResponse(
        res,
        400,
        "Valid branch_company_id is required",
        null
      );
    }

    if (!branch_name || branch_name.trim() === "") {
      return errorResponse(
        res,
        400,
        "branch_name is required",
        null
      );
    }

    if (!branch_code || branch_code.trim() === "") {
      return errorResponse(
        res,
        400,
        "branch_code is required",
        null
      );
    }

    // --------------------------------------------------------
    // Check company exists and is active
    // --------------------------------------------------------

    const companyResult = await db.query(
      `
      SELECT cpt_id
      FROM companies_master
      WHERE cpt_id = $1
        AND cpt_is_active = TRUE
      `,
      [branch_company_id]
    );

    if (companyResult.rows.length === 0) {
      return errorResponse(
        res,
        400,
        "Company not found or inactive",
        null
      );
    }

    // --------------------------------------------------------
    // Insert branch
    // --------------------------------------------------------

    const query = `
      INSERT INTO branch_master
      (
        branch_company_id,
        branch_name,
        branch_code,
        address_line_1,
        address_line_2,
        country_id,
        state_id,
        city_id,
        postal_code,
        created_by,
        created_at,
        is_active
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
        $8,
        $9,
        $10,
        CURRENT_TIMESTAMP,
        TRUE
      )
      RETURNING *
    `;

    const values = [
      Number(branch_company_id),
      branch_name.trim(),
      branch_code.trim(),
      address_line_1 || null,
      address_line_2 || null,
      country_id || null,
      state_id || null,
      city_id || null,
      postal_code || null,
      created_by || null
    ];

    const result = await db.query(query, values);

    return successResponse(
      res,
      201,
      "Branch created successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to create branch"
    );
  }
};


// ============================================================
// GET BRANCH BY ID
// ============================================================

const getBranchById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid branch_id is required",
        null
      );
    }

    const query = `
      SELECT
        bm.*,

        -- Company
        cm.cpt_name AS company_name,

        -- Country
        com.country_name AS country_name,

        -- State
        sm.state_name AS state_name,

        -- City
        cim.city_name AS city_name,

        -- Created By
        cp.pr_first_name AS "CreatedByName",

        -- Updated By
        up.pr_first_name AS "UpdatedByName"

      FROM branch_master bm

      -- Company
      LEFT JOIN companies_master cm
        ON cm.cpt_id = bm.branch_company_id

      -- Country
      LEFT JOIN country_master com
        ON com.country_id = bm.country_id

      -- State
      LEFT JOIN state_master sm
        ON sm.state_id = bm.state_id

      -- City
      LEFT JOIN city_master cim
        ON cim.city_id = bm.city_id

      -- Created By
      LEFT JOIN personal cp
        ON cp.pr_id = bm.created_by

      -- Updated By
      LEFT JOIN personal up
        ON up.pr_id = bm.updated_by

      WHERE bm.branch_id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Branch not found",
        null
      );
    }

    return successResponse(
      res,
      200,
      "Branch fetched successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch branch"
    );
  }
};


// ============================================================
// GET ALL BRANCHES
// ============================================================

const getAllBranches = async (req, res) => {
  try {
    const {
      is_active,
      company_id
    } = req.query;

    const conditions = [];
    const values = [];

    // --------------------------------------------------------
    // Active filter
    // --------------------------------------------------------

    if (is_active !== undefined) {

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

      values.push(is_active === "true");

      conditions.push(
        `bm.is_active = $${values.length}`
      );
    }

    // --------------------------------------------------------
    // Company filter
    // --------------------------------------------------------

    if (company_id !== undefined) {

      if (!company_id || isNaN(company_id)) {
        return errorResponse(
          res,
          400,
          "Valid company_id is required",
          null
        );
      }

      values.push(Number(company_id));

      conditions.push(
        `bm.branch_company_id = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // --------------------------------------------------------
    // Query
    // --------------------------------------------------------

    const query = `
      SELECT
        bm.*,

        cm.cpt_name AS company_name,

        cp.pr_first_name AS "CreatedByName",

        up.pr_first_name AS "UpdatedByName"

      FROM branch_master bm

      LEFT JOIN companies_master cm
        ON cm.cpt_id = bm.branch_company_id

      LEFT JOIN personal cp
        ON cp.pr_id = bm.created_by

      LEFT JOIN personal up
        ON up.pr_id = bm.updated_by

      ${whereClause}

      ORDER BY bm.branch_id ASC
    `;

    const result = await db.query(
      query,
      values
    );

    return successResponse(
      res,
      200,
      "Branches fetched successfully",
      result.rows
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch branches"
    );
  }
};


// ============================================================
// GET PAGINATED BRANCHES
// ============================================================

const getPaginatedBranches = async (req, res) => {
  try {
    const {
      is_active,
      company_id
    } = req.query;

    const {
      page,
      limit,
      offset
    } = getPaginationParams(req.query);

    const conditions = [];
    const values = [];

    // --------------------------------------------------------
    // Active filter
    // --------------------------------------------------------

    if (is_active !== undefined) {

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

      values.push(is_active === "true");

      conditions.push(
        `bm.is_active = $${values.length}`
      );
    }

    // --------------------------------------------------------
    // Company filter
    // --------------------------------------------------------

    if (company_id !== undefined) {

      if (!company_id || isNaN(company_id)) {
        return errorResponse(
          res,
          400,
          "Valid company_id is required",
          null
        );
      }

      values.push(Number(company_id));

      conditions.push(
        `bm.branch_company_id = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // --------------------------------------------------------
    // Count query
    // --------------------------------------------------------

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM branch_master bm
      ${whereClause}
    `;

    const countResult = await db.query(
      countQuery,
      values
    );

    const total_records =
      countResult.rows[0].total;

    const total_pages =
      Math.ceil(total_records / limit) || 0;

    // --------------------------------------------------------
    // Data query
    // --------------------------------------------------------

    const dataValues = [
      ...values,
      limit,
      offset
    ];

    const limitPosition = values.length + 1;
    const offsetPosition = values.length + 2;

    const dataQuery = `
      SELECT
        bm.*,

        cm.cpt_name AS company_name,

        cp.pr_first_name AS "CreatedByName",

        up.pr_first_name AS "UpdatedByName"

      FROM branch_master bm

      LEFT JOIN companies_master cm
        ON cm.cpt_id = bm.branch_company_id

      LEFT JOIN personal cp
        ON cp.pr_id = bm.created_by

      LEFT JOIN personal up
        ON up.pr_id = bm.updated_by

      ${whereClause}

      ORDER BY bm.branch_id ASC

      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `;

    const dataResult = await db.query(
      dataQuery,
      dataValues
    );

    return paginatedResponse(
      res,
      200,
      "Branches fetched successfully",
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
      "Failed to fetch paginated branches"
    );
  }
};


// ============================================================
// UPDATE BRANCH
// ============================================================

const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid branch_id is required",
        null
      );
    }

    // --------------------------------------------------------
    // Check branch exists
    // --------------------------------------------------------

    const existing = await db.query(
      `
      SELECT *
      FROM branch_master
      WHERE branch_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Branch not found",
        null
      );
    }

    const {
      branch_company_id,
      branch_name,
      branch_code,
      address_line_1,
      address_line_2,
      country_id,
      state_id,
      city_id,
      postal_code,
      updated_by,
      is_active
    } = req.body;

    // --------------------------------------------------------
    // Validate branch name
    // --------------------------------------------------------

    if (
      branch_name !== undefined &&
      (
        branch_name === null ||
        branch_name.trim() === ""
      )
    ) {
      return errorResponse(
        res,
        400,
        "branch_name cannot be empty",
        null
      );
    }

    // --------------------------------------------------------
    // Validate branch code
    // --------------------------------------------------------

    if (
      branch_code !== undefined &&
      (
        branch_code === null ||
        branch_code.trim() === ""
      )
    ) {
      return errorResponse(
        res,
        400,
        "branch_code cannot be empty",
        null
      );
    }

    // --------------------------------------------------------
    // Validate company
    // --------------------------------------------------------

    if (
      branch_company_id !== undefined &&
      branch_company_id !== null
    ) {

      if (
        branch_company_id === "" ||
        isNaN(branch_company_id)
      ) {
        return errorResponse(
          res,
          400,
          "Valid branch_company_id is required",
          null
        );
      }

      const companyResult = await db.query(
        `
        SELECT cpt_id
        FROM companies_master
        WHERE cpt_id = $1
          AND cpt_is_active = TRUE
        `,
        [branch_company_id]
      );

      if (companyResult.rows.length === 0) {
        return errorResponse(
          res,
          400,
          "Company not found or inactive",
          null
        );
      }
    }

    // --------------------------------------------------------
    // Update branch
    // --------------------------------------------------------

    const query = `
      UPDATE branch_master

      SET
        branch_company_id =
          COALESCE($1, branch_company_id),

        branch_name =
          COALESCE($2, branch_name),

        branch_code =
          COALESCE($3, branch_code),

        address_line_1 =
          COALESCE($4, address_line_1),

        address_line_2 =
          COALESCE($5, address_line_2),

        country_id =
          COALESCE($6, country_id),

        state_id =
          COALESCE($7, state_id),

        city_id =
          COALESCE($8, city_id),

        postal_code =
          COALESCE($9, postal_code),

        updated_by =
          COALESCE($10, updated_by),

        is_active =
          COALESCE($11, is_active),

        updated_at =
          CURRENT_TIMESTAMP

      WHERE branch_id = $12

      RETURNING *
    `;

    const values = [
      branch_company_id !== undefined
        ? branch_company_id
        : null,

      branch_name !== undefined
        ? branch_name.trim()
        : null,

      branch_code !== undefined
        ? branch_code.trim()
        : null,

      address_line_1 !== undefined
        ? address_line_1
        : null,

      address_line_2 !== undefined
        ? address_line_2
        : null,

      country_id !== undefined
        ? country_id
        : null,

      state_id !== undefined
        ? state_id
        : null,

      city_id !== undefined
        ? city_id
        : null,

      postal_code !== undefined
        ? postal_code
        : null,

      updated_by !== undefined
        ? updated_by
        : null,

      is_active !== undefined
        ? is_active
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
      "Branch updated successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to update branch"
    );
  }
};


// ============================================================
// DELETE BRANCH - SOFT DELETE
// ============================================================

const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid branch_id is required",
        null
      );
    }

    // --------------------------------------------------------
    // Check branch exists
    // --------------------------------------------------------

    const existing = await db.query(
      `
      SELECT branch_id
      FROM branch_master
      WHERE branch_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Branch not found",
        null
      );
    }

    const {
      updated_by
    } = req.body;

    // --------------------------------------------------------
    // Soft delete
    // --------------------------------------------------------

    const query = `
      UPDATE branch_master

      SET
        is_active = FALSE,

        updated_by =
          COALESCE($1, updated_by),

        updated_at =
          CURRENT_TIMESTAMP

      WHERE branch_id = $2

      RETURNING *
    `;

    const result = await db.query(
      query,
      [
        updated_by || null,
        id
      ]
    );

    return successResponse(
      res,
      200,
      "Branch deleted successfully",
      result.rows[0]
    );

  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to delete branch"
    );
  }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createBranch,
  getBranchById,
  getAllBranches,
  getPaginatedBranches,
  updateBranch,
  deleteBranch
};