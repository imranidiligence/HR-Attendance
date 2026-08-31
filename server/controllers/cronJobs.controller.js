const { db } = require("../db/connectDB");
const {
  registerJob,
  stopJob,
  reloadJob,
  runJobManually,
  getActiveJobs,
  isJobActive,
} = require("../cron/scheduler.manager");
const { buildCronExpression, describeSchedule } = require("../utils/cronBuilder");
/*
|--------------------------------------------------------------------------
| GET /api/cron-jobs
| List all jobs, merged with live "is currently registered" status
|--------------------------------------------------------------------------
*/
async function listJobs(req, res) {
  try {
    const result = await db.query(`
      SELECT
        cj.*,
        (SELECT status FROM cron_job_executions WHERE job_id = cj.id ORDER BY started_at DESC LIMIT 1) AS last_status,
        (SELECT started_at FROM cron_job_executions WHERE job_id = cj.id ORDER BY started_at DESC LIMIT 1) AS last_run_at,
        (SELECT duration_ms FROM cron_job_executions WHERE job_id = cj.id ORDER BY started_at DESC LIMIT 1) AS last_duration_ms
      FROM cron_jobs cj
      ORDER BY cj.id
    `);

    const activeJobCodes = new Set(getActiveJobs());

    const jobs = result.rows.map((job) => ({
      ...job,
      is_active_in_memory: activeJobCodes.has(job.job_code),
      schedule_display: describeSchedule(job.schedule_config),
    }));

    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error("[API] listJobs error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch jobs" });
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/cron-jobs/:id
|--------------------------------------------------------------------------
*/
async function getJob(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM cron_jobs WHERE id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const job = result.rows[0];
    job.is_active_in_memory = isJobActive(job.job_code);

    res.json({ success: true, data: job });
  } catch (error) {
    console.error("[API] getJob error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch job" });
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/cron-jobs
| Create a new job. Note: job_code must map to a handler already
| registered in jobHandlers (scheduler.manager.js) or it will be
| created disabled/unregistered until a handler exists.
|--------------------------------------------------------------------------
*/
async function createJob(req, res) {
  try {
    const {
      job_code,
      job_name,
      description,
      schedule, // friendly config from the frontend — NOT raw cron
      timezone,
      is_enabled,
      run_on_startup,
      retry_enabled,
      max_retries,
    } = req.body;

    if (!job_code || !job_name || !schedule) {
      return res.status(400).json({
        success: false,
        message: "job_code, job_name and schedule are required",
      });
    }

    let cron_expression;
    try {
      cron_expression = buildCronExpression(schedule);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const result = await db.query(
      `
      INSERT INTO cron_jobs
      (
        job_code, job_name, description, cron_expression, schedule_config,
        timezone, is_enabled, run_on_startup, retry_enabled, max_retries,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        job_code,
        job_name,
        description || null,
        cron_expression,
        JSON.stringify(schedule),
        timezone || "Asia/Kolkata",
        is_enabled ?? true,
        run_on_startup ?? false,
        retry_enabled ?? false,
        max_retries ?? 0,
        req.user?.id || null,
      ]
    );

    const job = result.rows[0];

    if (job.is_enabled) {
      await registerJob(job);
    }

    res.status(201).json({
      success: true,
      data: { ...job, schedule_display: describeSchedule(schedule) },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "job_code already exists" });
    }
    console.error("[API] createJob error:", error.message);
    res.status(500).json({ success: false, message: "Failed to create job" });
  }
}

/*
|--------------------------------------------------------------------------
| PUT /api/cron-jobs/:id
| Update job config, then re-register (or stop) it live.
|--------------------------------------------------------------------------
*/
async function updateJob(req, res) {
  try {
    const { id } = req.params;

    const existing = await db.query(`SELECT * FROM cron_jobs WHERE id = $1`, [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const current = existing.rows[0];

    const {
      job_name = current.job_name,
      description = current.description,
      schedule = current.schedule_config, // friendly config, not raw cron
      timezone = current.timezone,
      is_enabled = current.is_enabled,
      run_on_startup = current.run_on_startup,
      retry_enabled = current.retry_enabled,
      max_retries = current.max_retries,
    } = req.body;

    let cron_expression;
    try {
      cron_expression = buildCronExpression(schedule);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const result = await db.query(
      `
      UPDATE cron_jobs
      SET
        job_name = $1,
        description = $2,
        cron_expression = $3,
        schedule_config = $4,
        timezone = $5,
        is_enabled = $6,
        run_on_startup = $7,
        retry_enabled = $8,
        max_retries = $9,
        updated_by = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
      `,
      [
        job_name,
        description,
        cron_expression,
        JSON.stringify(schedule),
        timezone,
        is_enabled,
        run_on_startup,
        retry_enabled,
        max_retries,
        req.user?.id || null,
        id,
      ]
    );

    await reloadJob(id);

    res.json({
      success: true,
      data: { ...result.rows[0], schedule_display: describeSchedule(schedule) },
    });
  } catch (error) {
    console.error("[API] updateJob error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update job" });
  }
}

/*
|--------------------------------------------------------------------------
| PATCH /api/cron-jobs/:id/toggle
| Quick enable/disable shortcut
|--------------------------------------------------------------------------
*/
async function toggleJob(req, res) {
  try {
    const { id } = req.params;

    const existing = await db.query(`SELECT * FROM cron_jobs WHERE id = $1`, [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const newState = !existing.rows[0].is_enabled;

    await db.query(
      `UPDATE cron_jobs SET is_enabled = $1, updated_at = NOW() WHERE id = $2`,
      [newState, id]
    );

    await reloadJob(id);

    res.json({ success: true, data: { id: Number(id), is_enabled: newState } });
  } catch (error) {
    console.error("[API] toggleJob error:", error.message);
    res.status(500).json({ success: false, message: "Failed to toggle job" });
  }
}

/*
|--------------------------------------------------------------------------
| DELETE /api/cron-jobs/:id
|--------------------------------------------------------------------------
*/
async function deleteJob(req, res) {
  try {
    const { id } = req.params;

    const existing = await db.query(`SELECT * FROM cron_jobs WHERE id = $1`, [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    stopJob(existing.rows[0].job_code);

    await db.query(`DELETE FROM cron_jobs WHERE id = $1`, [id]);

    res.json({ success: true, message: "Job deleted" });
  } catch (error) {
    console.error("[API] deleteJob error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete job" });
  }
}

/*
|--------------------------------------------------------------------------
| POST /api/cron-jobs/:id/run
| Trigger a job immediately, outside its schedule
|--------------------------------------------------------------------------
*/
async function runNow(req, res) {
  try {
    const { id } = req.params;

    const result = await runJobManually(id);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[API] runNow error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
}

/*
|--------------------------------------------------------------------------
| GET /api/cron-jobs/:id/executions
| Paginated execution history for one job
|--------------------------------------------------------------------------
*/
async function getExecutions(req, res) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      db.query(
        `
        SELECT *
        FROM cron_job_executions
        WHERE job_id = $1
        ORDER BY started_at DESC
        LIMIT $2 OFFSET $3
        `,
        [id, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*) FROM cron_job_executions WHERE job_id = $1`,
        [id]
      ),
    ]);

    res.json({
      success: true,
      data: rows.rows,
      pagination: {
        page,
        limit,
        total: Number(count.rows[0].count),
        totalPages: Math.ceil(Number(count.rows[0].count) / limit),
      },
    });
  } catch (error) {
    console.error("[API] getExecutions error:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch executions" });
  }
}

module.exports = {
  listJobs,
  getJob,
  createJob,
  updateJob,
  toggleJob,
  deleteJob,
  runNow,
  getExecutions,
};