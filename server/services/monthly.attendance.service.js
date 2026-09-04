/*
  BACKFILL_START_DATE is now only a safety floor (guards against
  dirty/garbage old timestamps in attendance_logs). The real
  backfill start per employee is GREATEST(joining_date, their
  first real punch, BACKFILL_START_DATE) — see first_punch_per_emp.

  Holiday/weekly-off dates are handled separately (see
  non_working_backfill_pairs below) and only require joining_date,
  since marking a date "Holiday" or "Weekly Off" carries no risk
  of falsely accusing someone of being absent — unlike Absent,
  it never needs punch evidence to justify itself.
*/
const BACKFILL_START_DATE = process.env.ATTENDANCE_BACKFILL_START_DATE || "2025-07-01";

async function generateMonthlyAttendance(client) {
  const query = `
    WITH active_setting AS
    (
      SELECT
        s.id,
        s.office_start_time,
        s.office_end_time,
        s.grace_period_minutes,
        s.half_day_after_minutes
      FROM public.attendance_settings s
      WHERE s.is_active = TRUE
      ORDER BY s.id DESC
      LIMIT 1
    ),

    stale_pairs AS
    (
      SELECT DISTINCT
        TRIM(al.emp_id) AS emp_id,
        (al.punch_time AT TIME ZONE 'Asia/Kolkata')::DATE
          AS attendance_date

      FROM public.attendance_logs al

      WHERE al.emp_id IS NOT NULL
        AND TRIM(al.emp_id) <> ''
        AND al.punch_time IS NOT NULL

        AND NOT EXISTS
        (
          SELECT 1
          FROM public.monthly_attendance da
          WHERE da.emp_id = TRIM(al.emp_id)
            AND da.attendance_date =
                  (al.punch_time AT TIME ZONE 'Asia/Kolkata')::DATE
            AND da.updated_at >= al.created_at
        )
    ),

    today_pairs AS
    (
      SELECT
        TRIM(o.or_emp_id) AS emp_id,
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
          AS attendance_date

      FROM public.organizations o

      WHERE o.or_emp_id IS NOT NULL
        AND TRIM(o.or_emp_id) <> ''
        AND COALESCE(o.or_is_active, TRUE) = TRUE

        AND (
          o.or_joining_date IS NULL
          OR o.or_joining_date <=
             (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
        )

        AND (
          o.or_leaving_date IS NULL
          OR o.or_leaving_date >=
             (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
        )
    ),

    first_punch_per_emp AS
    (
      SELECT
        TRIM(al.emp_id) AS emp_id,
        MIN((al.punch_time AT TIME ZONE 'Asia/Kolkata')::DATE) AS first_punch_date

      FROM public.attendance_logs al

      WHERE al.emp_id IS NOT NULL
        AND TRIM(al.emp_id) <> ''
        AND al.punch_time IS NOT NULL

      GROUP BY TRIM(al.emp_id)
    ),

    backfill_pairs AS
    (
      SELECT
        TRIM(o.or_emp_id) AS emp_id,
        d.attendance_date

      FROM public.organizations o

      JOIN first_punch_per_emp fp
        ON fp.emp_id = TRIM(o.or_emp_id)

      CROSS JOIN LATERAL
      (
        SELECT generate_series(
          GREATEST(
            o.or_joining_date,
            fp.first_punch_date,
            '${BACKFILL_START_DATE}'::DATE
          ),
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
          INTERVAL '1 day'
        )::DATE AS attendance_date
      ) d

      WHERE o.or_emp_id IS NOT NULL
        AND TRIM(o.or_emp_id) <> ''
        AND COALESCE(o.or_is_active, TRUE) = TRUE
        AND o.or_joining_date IS NOT NULL

        AND (
          o.or_leaving_date IS NULL
          OR o.or_leaving_date >= d.attendance_date
        )

        AND NOT EXISTS
        (
          SELECT 1
          FROM public.monthly_attendance da
          WHERE da.emp_id = TRIM(o.or_emp_id)
            AND da.attendance_date = d.attendance_date
        )
    ),

    /* =====================================================
       BACKFILL (NON-WORKING DAYS): every (active employee,
       date) pair from joining_date onward that is ALREADY
       KNOWN to be a holiday or weekly-off — regardless of
       whether the employee has ever punched.
    ===================================================== */

    non_working_backfill_pairs AS
    (
      SELECT
        TRIM(o.or_emp_id) AS emp_id,
        d.attendance_date

      FROM public.organizations o

      CROSS JOIN LATERAL
      (
        SELECT generate_series(
          GREATEST(
            o.or_joining_date,
            '${BACKFILL_START_DATE}'::DATE
          ),
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
          INTERVAL '1 day'
        )::DATE AS attendance_date
      ) d

      CROSS JOIN active_setting s

      LEFT JOIN public.attendance_weekly_rules r
        ON r.attendance_setting_id = s.id
       AND r.day_of_week = EXTRACT(ISODOW FROM d.attendance_date)::INTEGER

      LEFT JOIN public.holidays h
        ON h.holiday_date = d.attendance_date
       AND COALESCE(h.is_active, TRUE) = TRUE

      WHERE o.or_emp_id IS NOT NULL
        AND TRIM(o.or_emp_id) <> ''
        AND COALESCE(o.or_is_active, TRUE) = TRUE
        AND o.or_joining_date IS NOT NULL

        AND (
          o.or_leaving_date IS NULL
          OR o.or_leaving_date >= d.attendance_date
        )

        AND (
          h.holiday_id IS NOT NULL
          OR COALESCE(r.is_working_day, TRUE) = FALSE
        )

        AND NOT EXISTS
        (
          SELECT 1
          FROM public.monthly_attendance da
          WHERE da.emp_id = TRIM(o.or_emp_id)
            AND da.attendance_date = d.attendance_date
        )
    ),

    target_pairs AS
    (
      SELECT emp_id, attendance_date FROM stale_pairs
      UNION
      SELECT emp_id, attendance_date FROM today_pairs
      UNION
      SELECT emp_id, attendance_date FROM backfill_pairs
      UNION
      SELECT emp_id, attendance_date FROM non_working_backfill_pairs
    ),

    distinct_target_dates AS
    (
      SELECT DISTINCT attendance_date
      FROM target_pairs
    ),

    day_rule AS
    (
      SELECT

        d.attendance_date,

        s.id AS setting_id,
        s.grace_period_minutes,
        s.half_day_after_minutes,

        r.full_day_hours,
        r.half_day_hours,

        COALESCE(r.is_working_day, TRUE) AS is_working_day,
        COALESCE(r.start_time, s.office_start_time) AS start_time,
        COALESCE(r.end_time, s.office_end_time) AS end_time

      FROM distinct_target_dates d

      CROSS JOIN active_setting s

      LEFT JOIN public.attendance_weekly_rules r
        ON r.attendance_setting_id = s.id
       AND r.day_of_week =
           EXTRACT(ISODOW FROM d.attendance_date)::INTEGER
    ),

    holiday_info AS
    (
      SELECT

        d.attendance_date,

        h.holiday_id,
        h.holiday_name,
        h.is_paid,
        h.remarks

      FROM distinct_target_dates d

      LEFT JOIN LATERAL
      (
        SELECT
          h2.holiday_id,
          h2.holiday_name,
          h2.is_paid,
          h2.remarks
        FROM public.holidays h2
        WHERE h2.holiday_date = d.attendance_date
          AND COALESCE(h2.is_active, TRUE) = TRUE
        ORDER BY h2.holiday_id
        LIMIT 1
      ) h ON TRUE
    ),

    statuses AS
    (
      SELECT

        MAX(id) FILTER (WHERE LOWER(TRIM(status_name)) = 'present')    AS present_id,
        MAX(id) FILTER (WHERE LOWER(TRIM(status_name)) = 'working')    AS working_id,
        MAX(id) FILTER (WHERE LOWER(TRIM(status_name)) = 'half day')   AS half_day_id,
        MAX(id) FILTER (WHERE LOWER(TRIM(status_name)) = 'holiday')    AS holiday_id,
        MAX(id) FILTER (WHERE LOWER(TRIM(status_name)) = 'weekly off') AS weekly_off_id,
        MAX(id) FILTER (WHERE LOWER(TRIM(status_name)) = 'absent')     AS absent_id

      FROM public.attendence_status
      WHERE is_active = TRUE
    ),

    employees AS
    (
      SELECT DISTINCT
        tp.emp_id,
        tp.attendance_date

      FROM target_pairs tp

      JOIN public.organizations o
        ON TRIM(o.or_emp_id) = tp.emp_id

      WHERE COALESCE(o.or_is_active, TRUE) = TRUE

        AND (
          o.or_joining_date IS NULL
          OR o.or_joining_date <= tp.attendance_date
        )

        AND (
          o.or_leaving_date IS NULL
          OR o.or_leaving_date >= tp.attendance_date
        )
    ),

    punch_data AS
    (
      SELECT

        TRIM(al.emp_id) AS emp_id,

        (al.punch_time AT TIME ZONE 'Asia/Kolkata')::DATE
          AS attendance_date,

        al.punch_time AT TIME ZONE 'Asia/Kolkata'
          AS punch_local

      FROM public.attendance_logs al

      WHERE al.emp_id IS NOT NULL
        AND TRIM(al.emp_id) <> ''
        AND al.punch_time IS NOT NULL

        AND EXISTS
        (
          SELECT 1
          FROM employees e
          WHERE e.emp_id = TRIM(al.emp_id)
            AND e.attendance_date =
                  (al.punch_time AT TIME ZONE 'Asia/Kolkata')::DATE
        )
    ),

    punches AS
    (
      SELECT

        e.emp_id,
        e.attendance_date,

        MIN(p.punch_local) AS punch_in,

        CASE
          WHEN MIN(p.punch_local) IS NULL THEN NULL
          WHEN MIN(p.punch_local) = MAX(p.punch_local) THEN NULL
          ELSE MAX(p.punch_local)
        END AS punch_out

      FROM employees e

      LEFT JOIN punch_data p
        ON p.emp_id = e.emp_id
       AND p.attendance_date = e.attendance_date

      GROUP BY e.emp_id, e.attendance_date
    ),

    calculated AS
    (
      SELECT

        p.emp_id,
        p.attendance_date,

        p.punch_in,
        p.punch_out,

        CASE
          WHEN p.punch_in IS NULL THEN INTERVAL '0'
          WHEN p.punch_out IS NULL THEN INTERVAL '0'
          ELSE p.punch_out - p.punch_in
        END AS total_hours,

        CASE
          WHEN h.holiday_id IS NOT NULL THEN INTERVAL '0'
          WHEN dr.is_working_day = FALSE THEN INTERVAL '0'
          ELSE dr.end_time - dr.start_time
        END AS expected_hours,

        CASE
          WHEN p.punch_in IS NULL THEN 0
          WHEN h.holiday_id IS NOT NULL THEN 0
          WHEN dr.is_working_day = FALSE THEN 0
          WHEN p.punch_in::TIME <= dr.start_time THEN 0
          ELSE GREATEST(0,
            FLOOR(EXTRACT(EPOCH FROM (p.punch_in::TIME - dr.start_time)) / 60)::INTEGER
          )
        END AS late_arrival,

        CASE
          WHEN p.punch_in IS NULL THEN FALSE
          WHEN h.holiday_id IS NOT NULL THEN FALSE
          WHEN dr.is_working_day = FALSE THEN FALSE
          WHEN p.punch_in::TIME >
               (dr.start_time + MAKE_INTERVAL(mins => dr.grace_period_minutes))
            THEN TRUE
          ELSE FALSE
        END AS is_late_arrived,

        CASE
          WHEN p.punch_out IS NULL THEN 0
          WHEN h.holiday_id IS NOT NULL THEN 0
          WHEN dr.is_working_day = FALSE THEN 0
          WHEN p.punch_out::TIME >= dr.end_time THEN 0
          ELSE GREATEST(0,
            FLOOR(EXTRACT(EPOCH FROM (dr.end_time - p.punch_out::TIME)) / 60)::INTEGER
          )
        END AS early_go,

        CASE
          WHEN p.punch_out IS NULL THEN FALSE
          WHEN h.holiday_id IS NOT NULL THEN FALSE
          WHEN dr.is_working_day = FALSE THEN FALSE
          WHEN p.punch_out::TIME < dr.end_time THEN TRUE
          ELSE FALSE
        END AS is_early_gone,

        CASE
          WHEN h.holiday_id IS NOT NULL THEN sid.holiday_id
          WHEN dr.is_working_day = FALSE THEN sid.weekly_off_id
          WHEN p.punch_in IS NULL THEN sid.absent_id
          WHEN p.punch_in::TIME >=
               (dr.start_time + MAKE_INTERVAL(mins => dr.half_day_after_minutes))
            THEN sid.half_day_id
          WHEN p.punch_out IS NULL THEN sid.working_id
          WHEN (p.punch_out - p.punch_in) < (dr.half_day_hours * INTERVAL '1 hour')
            THEN sid.half_day_id
          ELSE sid.present_id
        END AS status_id

      FROM punches p

      JOIN day_rule dr
        ON dr.attendance_date = p.attendance_date

      CROSS JOIN statuses sid

      LEFT JOIN holiday_info h
        ON h.attendance_date = p.attendance_date
    )

    INSERT INTO public.monthly_attendance
    (
      attendance_date, punch_in, punch_out,
      total_hours, expected_hours,
      created_at, updated_at, emp_id,
      late_arrival, is_late_arrived,
      early_go, is_early_gone, status_id
    )

    SELECT
      attendance_date, punch_in, punch_out,
      total_hours, expected_hours,
      CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata',
      CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata',
      emp_id,
      late_arrival, is_late_arrived,
      early_go, is_early_gone, status_id

    FROM calculated

    ON CONFLICT (emp_id, attendance_date)

    DO UPDATE SET
      punch_in = EXCLUDED.punch_in,
      punch_out = EXCLUDED.punch_out,
      total_hours = EXCLUDED.total_hours,
      expected_hours = EXCLUDED.expected_hours,
      late_arrival = EXCLUDED.late_arrival,
      is_late_arrived = EXCLUDED.is_late_arrived,
      early_go = EXCLUDED.early_go,
      is_early_gone = EXCLUDED.is_early_gone,
      status_id = EXCLUDED.status_id,
      updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata';
  `;

  const result = await client.query(query);
  return { touched: result.rowCount };
}

module.exports = { generateMonthlyAttendance };