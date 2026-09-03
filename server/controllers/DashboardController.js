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
      result.rows
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

const getWeeklyEmployeesData = async (req, res) => {
  try {
    const { emp_id } = req.params; // or req.query based on your routing
    
    if (!emp_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    const query = `
      WITH date_series AS (
        SELECT 
          generate_series(
            DATE_TRUNC('week', CURRENT_DATE)::date,
            DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '6 days',
            INTERVAL '1 day'
          )::date AS attendance_date
      ),
      week_days AS (
        SELECT 
          attendance_date,
          TO_CHAR(attendance_date, 'Dy') AS day_name,
          EXTRACT(DOW FROM attendance_date) AS day_of_week
        FROM date_series
      )
      SELECT 
        wd.attendance_date,
        wd.day_name,
        wa.punch_in,
        wa.punch_out,
        wa.total_hours,
        wa.expected_hours,
        wa.late_arrival,
        wa.is_late_arrived,
        wa.early_go,
        wa.is_early_gone,
        wa.status_id,
        CASE 
          WHEN wa.attendance_date IS NULL THEN 'No Data'
          ELSE 'Present'
        END AS attendance_status,
        CASE 
          WHEN EXTRACT(DOW FROM wd.attendance_date) IN (0, 6) THEN INTERVAL '0 hours'
          ELSE INTERVAL '9 hours 18 minutes'
        END AS target_hours
      FROM 
        week_days wd
      LEFT JOIN 
        weekly_attendance wa 
        ON wd.attendance_date = wa.attendance_date 
        AND wa.emp_id = $1
      ORDER BY 
        wd.attendance_date
    `;

    const result = await db.query(query, [emp_id]);

    return successResponse(
      res,
      200,
      "Weekly employee data fetched successfully",
      result.rows
    );
  } catch (error) {
    console.error("Weekly employee data error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch weekly employee data"
    );
  }
};

const getEmployeeWeeklyPieChartData = async (req, res) => {
  try {
    const { emp_id } = req.params;
    
    if (!emp_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    const query = `
      WITH current_week_dates AS (
        SELECT (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE) - 1)::integer * INTERVAL '1 day') + (n || ' days')::interval AS week_date
        FROM generate_series(0, 6) AS n
        WHERE (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE) - 1)::integer * INTERVAL '1 day') + (n || ' days')::interval <= CURRENT_DATE
      ),
      attendance_data AS (
        SELECT 
          ad.emp_id,
          ad.attendance_date,
          ats.status_name
        FROM daily_attendance ad 
        LEFT JOIN attendence_status ats ON ad.status_id = ats.id 
        WHERE ad.emp_id = $1
      )
      SELECT 
        COUNT(cwd.week_date) AS total_days,
        COALESCE(SUM(CASE WHEN ad.status_name IN ('Present', 'Working') THEN 1 ELSE 0 END), 0) AS present_days,
        COALESCE(SUM(CASE WHEN ad.status_name = 'Absent' THEN 1 ELSE 0 END), 0) AS absent_days
      FROM current_week_dates cwd
      LEFT JOIN attendance_data ad ON cwd.week_date = DATE(ad.attendance_date)
    `;

    const result = await db.query(query, [emp_id]);


    const totalDays = result.rows[0]?.total_days || 0;
    const presentDays = result.rows[0]?.present_days || 0;
    const absentDays = result.rows[0]?.absent_days || 0;
    const otherDays = totalDays - (presentDays + absentDays);

    const responseData = {
      total_days: totalDays,
      present_days: presentDays,
      absent_days: absentDays,
      other_days: otherDays,
      pie_chart_data: [
        { 
          label: 'Present', 
          value: presentDays, 
          percentage: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : 0 
        },
        { 
          label: 'Absent', 
          value: absentDays, 
          percentage: totalDays > 0 ? ((absentDays / totalDays) * 100).toFixed(2) : 0 
        },
        { 
          label: 'Other', 
          value: otherDays, 
          percentage: totalDays > 0 ? ((otherDays / totalDays) * 100).toFixed(2) : 0 
        }
      ]
    };

    return successResponse(
      res,
      200,
      "Employee weekly pie chart data fetched successfully",
      responseData
    );
  } catch (error) {
    console.error("Employee weekly pie chart data error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch employee weekly pie chart data"
    );
  }
};

const getMonthlyEmployeesData = async (req, res) => {
  try {
    const { emp_id } = req.params;

    if (!emp_id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required"
      });
    }

    const query = `
      WITH date_series AS (
        SELECT 
          generate_series(
            DATE_TRUNC('month', CURRENT_DATE)::date,
            (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
            INTERVAL '1 day'
          )::date AS attendance_date
      ),
      month_days AS (
        SELECT 
          attendance_date,
          TO_CHAR(attendance_date, 'Dy') AS day_name,
          EXTRACT(DOW FROM attendance_date) AS day_of_week
        FROM date_series
      )
      SELECT 
        md.attendance_date,
        md.day_name,
        wa.punch_in,
        wa.punch_out,
        wa.total_hours,
        wa.expected_hours,
        wa.late_arrival,
        wa.is_late_arrived,
        wa.early_go,
        wa.is_early_gone,
        wa.status_id,

        CASE 
          WHEN wa.status_id = 1 THEN 'Present'
          WHEN wa.status_id = 2 THEN 'Absent'
          WHEN wa.status_id = 3 THEN 'Working'
          WHEN wa.status_id = 4 THEN 'Half Day'
          WHEN wa.status_id = 5 THEN 'Holiday'
          WHEN wa.status_id = 6 THEN 'Leave'
          WHEN wa.status_id = 7 THEN 'Weekly Off'
          ELSE 'Absent'
        END AS attendance_status,

        CASE 
          WHEN EXTRACT(DOW FROM md.attendance_date) IN (0, 6) 
            THEN INTERVAL '0 hours'
          ELSE INTERVAL '9 hours 18 minutes'
        END AS target_hours

      FROM month_days md

      LEFT JOIN weekly_attendance wa 
        ON md.attendance_date = wa.attendance_date 
        AND wa.emp_id = $1

      ORDER BY md.attendance_date;
    `;

    const result = await db.query(query, [emp_id]);

    return successResponse(
      res,
      200,
      "Monthly employee data fetched successfully",
      result.rows
    );

  } catch (error) {
    console.error("Monthly employee data error:", error);

    return handleDbError(
      res,
      error,
      "Failed to fetch monthly employee data"
    );
  }
};


module.exports = {
  getActiveEmployeeCount,
  getActive_Present_EmployeeCount,
  getActive_Absent_EmployeeCount,
  getActive_Employee_Department_Count,
  getWeeklyEmployeesData,
  getEmployeeWeeklyPieChartData,
  getMonthlyEmployeesData
};