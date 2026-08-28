async function syncActivityToAttendanceLogs(client) {
  const query = `
    INSERT INTO public.attendance_logs
    (
      emp_id,
      punch_time,
      device_ip,
      device_sn,
      created_at,
      raw_log
    )
    SELECT
      TRIM(al.emp_id),

      /*
        activity_log.punch_time is timestamp WITHOUT
        timezone and represents IST.

        Convert it to timestamptz correctly.
      */
      al.punch_time AT TIME ZONE 'Asia/Kolkata',

      al.device_ip,
      al.device_sn,

      /*
        attendance_logs.created_at is timestamp WITHOUT
        timezone in your schema.
      */
      CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata',

      jsonb_build_object(
        'source',
          'activity_log',

        'activity_log_id',
          al.id,

        'emp_id',
          al.emp_id,

        'punch_time',
          al.punch_time,

        'device_ip',
          al.device_ip,

        'device_sn',
          al.device_sn
      )

    FROM public.activity_log al

    WHERE al.emp_id IS NOT NULL
      AND TRIM(al.emp_id) <> ''

      AND al.punch_time IS NOT NULL

      /*
        IMPORTANT:

        activity_log.received_time is TIMESTAMPTZ,
        so use it for the 2-minute safety window.

        This avoids timezone ambiguity around created_at.
      */

    ON CONFLICT (emp_id, punch_time)
    DO NOTHING;
  `;

  const result = await client.query(query);            // was db.query
  return { inserted: result.rowCount };
}

module.exports = { syncActivityToAttendanceLogs };
