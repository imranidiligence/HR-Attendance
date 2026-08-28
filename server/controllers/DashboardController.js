const { db } = require("../db/connectDB");
const {
  successResponse,
  handleDbError
} = require("../utils/response");

const getActiveEmployeeCount = async (req, res) => {
  try {
    const query = `
      SELECT COUNT(*)::int AS active_employee_count
      FROM organizations
      WHERE Or_Is_Active = TRUE
    `;

    const result = await db.query(query);

    return successResponse(
      res,
      200,
      "Active employee count fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Active employee count error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch active employee count"
    );
  }
};

const getActive_Present_EmployeeCount = async (req, res) => {
  try {
    const query = `
      SELECT COUNT(DISTINCT a.emp_id)::int AS today_present_count
      FROM attendance_logs a
      INNER JOIN organizations u ON u.or_emp_id = a.emp_id
      WHERE a.created_at >= CURRENT_DATE
        AND a.created_at < CURRENT_DATE + INTERVAL '1 day'
        AND u.or_is_active = TRUE
    `;

    const result = await db.query(query);

    return successResponse(
      res,
      200,
      "Active present employee count fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Active present employee count error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch active present employee count"
    );
  }
};

const getActive_Absent_EmployeeCount = async (req, res) => {
  try {
    const query = `
      SELECT COUNT(*)::int AS today_absent_count
      FROM organizations u
      WHERE u.or_is_active = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM attendance_logs a
          WHERE a.emp_id = u.or_emp_id
            AND a.created_at >= CURRENT_DATE
            AND a.created_at < CURRENT_DATE + INTERVAL '1 day'
        )
    `;

    const result = await db.query(query);

    return successResponse(
      res,
      200,
      "Active absent employee count fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Active absent employee count error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch active absent employee count"
    );
  }
};

const getActive_Employee_Department_Count = async (req, res) => {
  try {
    const query = `
      SELECT
          d."DepartmentName" AS department_name,
          COUNT(o.or_id) AS number_of_users,
          ROUND(
          COUNT(o.or_id) * 100.0 /
          NULLIF(SUM(COUNT(o.or_id)) OVER (), 0),
          2
          ) AS percent
          FROM department_master d
          LEFT JOIN organizations o
          ON o.or_department_id = d."DepartmentId"
          AND o.or_is_active = TRUE
          WHERE d."IsActive" = TRUE
          GROUP BY
          d."DepartmentId",
          d."DepartmentName"
          ORDER BY
          number_of_users DESC;
    `;

    const result = await db.query(query);

    return successResponse(
      res,
      200,
      "Active Department employee count fetched successfully",
      result.rows[0]
    );
  } catch (error) {
    console.error("Active Department employee count error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch active Department employee count"
    );
  }
};

module.exports = {
  getActiveEmployeeCount,
  getActive_Present_EmployeeCount,
  getActive_Absent_EmployeeCount,
  getActive_Employee_Department_Count
};