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

// Create Branch Location
const createBranchLocation = async (req, res) => {
  try {
    const {
      branch_id,
      address_line_1,
      address_line_2,
      country_id,
      state_id,
      city_id,
      postal_code,
      latitude,
      longitude,
      created_by,
    } = req.body;

    if (!branch_id) {
      return errorResponse(res, 400, "branch_id is required", null);
    }

    if (!address_line_1 || address_line_1.trim() === "") {
      return errorResponse(
        res,
        400,
        "address_line_1 is required",
        null
      );
    }

    const query = `
      INSERT INTO branch_location_master (
        branch_id,
        address_line_1,
        address_line_2,
        country_id,
        state_id,
        city_id,
        postal_code,
        latitude,
        longitude,
        created_by,
        created_at,
        is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        CURRENT_TIMESTAMP,
        TRUE
      )
      RETURNING *
    `;

    const values = [
      branch_id,
      address_line_1,
      address_line_2 || null,
      country_id || null,
      state_id || null,
      city_id || null,
      postal_code || null,
      latitude || null,
      longitude || null,
      created_by || null,
    ];

    const result = await db.query(query, values);

    return successResponse(
      res,
      201,
      "Branch location created successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to create branch location"
    );
  }
};

// Get Branch Location By ID
const getBranchLocationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid branch_location_id is required",
        null
      );
    }

    const result = await db.query(
      `
        SELECT *
        FROM branch_location_master
        WHERE branch_location_id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Branch location not found",
        null
      );
    }

    return successResponse(
      res,
      200,
      "Branch location fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch branch location"
    );
  }
};

// Get All Branch Locations
const getAllBranchLocations = async (req, res) => {
  try {
    const { is_active, branch_id } = req.query;

    const whereClause = buildIsActiveClause(is_active);

    let query;
    let params = [];

    if (branch_id) {
      const connector = whereClause ? " AND" : " WHERE";

      query = `
        SELECT *
        FROM branch_location_master
        ${whereClause}${connector} branch_id = $1
        ORDER BY branch_location_id ASC
      `;

      params = [branch_id];
    } else {
      query = `
        SELECT *
        FROM branch_location_master
        ${whereClause}
        ORDER BY branch_location_id ASC
      `;
    }

    const result = await db.query(query, params);

    return successResponse(
      res,
      200,
      "Branch locations fetched successfully",
      result.rows
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to fetch branch locations"
    );
  }
};

// Get Paginated Branch Locations
const getPaginatedBranchLocations = async (req, res) => {
  try {
    const { is_active, branch_id } = req.query;

    const { page, limit, offset } = getPaginationParams(req.query);

    let whereClause = buildIsActiveClause(is_active);
    let params = [];

    if (branch_id) {
      const connector = whereClause ? " AND" : " WHERE";
      whereClause += `${connector} branch_id = $1`;
      params.push(branch_id);
    }

    // Count
    const countResult = await db.query(
      `
        SELECT COUNT(*)::int AS total
        FROM branch_location_master
        ${whereClause}
      `,
      params
    );

    const total_records = countResult.rows[0].total;
    const total_pages = Math.ceil(total_records / limit) || 0;

    // Data
    const dataQuery = `
      SELECT *
      FROM branch_location_master
      ${whereClause}
      ORDER BY branch_location_id ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const dataParams = [...params, limit, offset];

    const dataResult = await db.query(
      dataQuery,
      dataParams
    );

    return paginatedResponse(
      res,
      200,
      "Branch locations fetched successfully",
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
      "Failed to fetch paginated branch locations"
    );
  }
};

// Update Branch Location
const updateBranchLocation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid branch_location_id is required",
        null
      );
    }

    // Check existing record
    const existing = await db.query(
      `
        SELECT *
        FROM branch_location_master
        WHERE branch_location_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Branch location not found",
        null
      );
    }

    const {
      branch_id,
      address_line_1,
      address_line_2,
      country_id,
      state_id,
      city_id,
      postal_code,
      latitude,
      longitude,
      updated_by,
      is_active,
    } = req.body;

    if (
      address_line_1 !== undefined &&
      address_line_1.trim() === ""
    ) {
      return errorResponse(
        res,
        400,
        "address_line_1 cannot be empty",
        null
      );
    }

    const query = `
      UPDATE branch_location_master
      SET
        branch_id = COALESCE($1, branch_id),
        address_line_1 = COALESCE($2, address_line_1),
        address_line_2 = COALESCE($3, address_line_2),
        country_id = COALESCE($4, country_id),
        state_id = COALESCE($5, state_id),
        city_id = COALESCE($6, city_id),
        postal_code = COALESCE($7, postal_code),
        latitude = COALESCE($8, latitude),
        longitude = COALESCE($9, longitude),
        updated_by = COALESCE($10, updated_by),
        is_active = COALESCE($11, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE branch_location_id = $12
      RETURNING *
    `;

    const values = [
      branch_id !== undefined ? branch_id : null,
      address_line_1 !== undefined ? address_line_1 : null,
      address_line_2 !== undefined ? address_line_2 : null,
      country_id !== undefined ? country_id : null,
      state_id !== undefined ? state_id : null,
      city_id !== undefined ? city_id : null,
      postal_code !== undefined ? postal_code : null,
      latitude !== undefined ? latitude : null,
      longitude !== undefined ? longitude : null,
      updated_by !== undefined ? updated_by : null,
      is_active !== undefined ? is_active : null,
      id,
    ];

    const result = await db.query(query, values);

    return successResponse(
      res,
      200,
      "Branch location updated successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to update branch location"
    );
  }
};

// Delete Branch Location - Soft Delete
const deleteBranchLocation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return errorResponse(
        res,
        400,
        "Valid branch_location_id is required",
        null
      );
    }

    // Check existing record
    const existing = await db.query(
      `
        SELECT *
        FROM branch_location_master
        WHERE branch_location_id = $1
      `,
      [id]
    );

    if (existing.rows.length === 0) {
      return errorResponse(
        res,
        404,
        "Branch location not found",
        null
      );
    }

    const { updated_by } = req.body;

    const query = `
      UPDATE branch_location_master
      SET
        is_active = FALSE,
        updated_by = COALESCE($1, updated_by),
        updated_at = CURRENT_TIMESTAMP
      WHERE branch_location_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [
      updated_by || null,
      id,
    ]);

    return successResponse(
      res,
      200,
      "Branch location deleted successfully",
      result.rows[0]
    );
  } catch (error) {
    return handleDbError(
      res,
      error,
      "Failed to delete branch location"
    );
  }
};

module.exports = {
  createBranchLocation,
  getBranchLocationById,
  getAllBranchLocations,
  getPaginatedBranchLocations,
  updateBranchLocation,
  deleteBranchLocation,
};