const cron = require("node-cron");
const { db } = require("../db/connectDB");

const {
  syncMachineToActivityLog,
} = require("../services/activity.log.service");

const {
  syncActivityToAttendanceLogs,
} = require("../services/attendance.log.service");

const {
  generateDailyAttendance,
} = require("../services/daily.attendance.service");

const {
  generateWeeklyAttendance,
} = require("../services/weekly.attendance.service");

const {
  generateMonthlyAttendance,
} = require("../services/monthly.attendance.service");

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/*
|--------------------------------------------------------------------------
| Active cron jobs
|--------------------------------------------------------------------------
|
| Map structure:
|
| attendance_pipeline -> node-cron task
| weekly_attendance   -> node-cron task
| monthly_attendance  -> node-cron task
|
*/

const activeJobs = new Map();

/*
|--------------------------------------------------------------------------
| Job Handlers
|--------------------------------------------------------------------------
|
| DB stores only job_code.
| JavaScript decides what that job actually does.
|
*/

async function runPipeline(client) {
  const runId = Math.random().toString(36).slice(2, 8);

  console.log(`[CRON][${runId}] Attendance pipeline started`);

  const machineResult = await syncMachineToActivityLog(client);

  console.log(
    `[CRON][${runId}] Stage 1 - machine -> activity_log:`,
    machineResult
  );

  const activityResult =
    await syncActivityToAttendanceLogs(client);

  console.log(
    `[CRON][${runId}] Stage 2 - activity_log -> attendance_logs:`,
    activityResult
  );

  const dailyResult =
    await generateDailyAttendance(client);

  console.log(
    `[CRON][${runId}] Stage 3 - attendance_logs -> daily_attendance:`,
    dailyResult
  );

  return {
    machineResult,
    activityResult,
    dailyResult,
  };
}


const jobHandlers = {
  attendance_pipeline: runPipeline,
  weekly_attendance: generateWeeklyAttendance,
  monthly_attendance: generateMonthlyAttendance,
};


/*
|--------------------------------------------------------------------------
| Stop existing job
|--------------------------------------------------------------------------
*/

function stopJob(jobCode) {
  const existingTask = activeJobs.get(jobCode);

  if (!existingTask) {
    return;
  }

  try {
    existingTask.stop();

    if (typeof existingTask.destroy === "function") {
      existingTask.destroy();
    }
  } catch (error) {
    console.error(
      `[CRON] Error stopping ${jobCode}:`,
      error.message
    );
  }

  activeJobs.delete(jobCode);

  console.log(`[CRON] Stopped job: ${jobCode}`);
}


/*
|--------------------------------------------------------------------------
| Execute Job
|--------------------------------------------------------------------------
|
| This is the common executor used by:
|
| 1. Scheduled execution
| 2. Manual execution from API
| 3. Startup execution
|
*/

async function executeJob(
  job,
  triggerType = "scheduled"
) {
  const client = await db.connect();

  let locked = false;
  let executionId = null;

  const startedAt = Date.now();

  try {
    /*
    |--------------------------------------------------------------------------
    | 1. Acquire advisory lock
    |--------------------------------------------------------------------------
    */

    const lockResult = await client.query(
      `
      SELECT pg_try_advisory_lock(hashtext($1)) AS locked
      `,
      [job.job_code]
    );

    locked = lockResult.rows[0]?.locked === true;

    /*
    |--------------------------------------------------------------------------
    | 2. If another server/process is already running this job
    |--------------------------------------------------------------------------
    */

    if (!locked) {
      console.log(
        `[CRON] ${job.job_code} skipped - previous run still in progress`
      );

      await client.query(
        `
        INSERT INTO cron_job_executions
        (
          job_id,
          job_code,
          started_at,
          completed_at,
          status,
          duration_ms,
          trigger_type
        )
        VALUES
        (
          $1,
          $2,
          NOW(),
          NOW(),
          'SKIPPED',
          0,
          $3
        )
        `,
        [
          job.id,
          job.job_code,
          triggerType,
        ]
      );

      return {
        status: "SKIPPED",
      };
    }


    /*
    |--------------------------------------------------------------------------
    | 3. Insert RUNNING monitoring record
    |--------------------------------------------------------------------------
    */

    const executionResult = await client.query(
      `
      INSERT INTO cron_job_executions
      (
        job_id,
        job_code,
        started_at,
        status,
        trigger_type
      )
      VALUES
      (
        $1,
        $2,
        NOW(),
        'RUNNING',
        $3
      )
      RETURNING id
      `,
      [
        job.id,
        job.job_code,
        triggerType,
      ]
    );

    executionId = executionResult.rows[0].id;


    /*
    |--------------------------------------------------------------------------
    | 4. Find handler
    |--------------------------------------------------------------------------
    */

    const handler = jobHandlers[job.job_code];

    if (!handler) {
      throw new Error(
        `No handler registered for job_code: ${job.job_code}`
      );
    }


    /*
    |--------------------------------------------------------------------------
    | 5. Execute actual business logic
    |--------------------------------------------------------------------------
    */

    console.log(
      `[CRON] ${job.job_code} started (${triggerType})`
    );

    const result = await handler(client);


    /*
    |--------------------------------------------------------------------------
    | 6. Mark SUCCESS
    |--------------------------------------------------------------------------
    */

    const durationMs = Date.now() - startedAt;

    await client.query(
      `
      UPDATE cron_job_executions
      SET
        status = 'SUCCESS',
        completed_at = NOW(),
        duration_ms = $1
      WHERE id = $2
      `,
      [
        durationMs,
        executionId,
      ]
    );


    console.log(
      `[CRON] ${job.job_code} completed successfully in ${durationMs} ms`
    );

    return {
      status: "SUCCESS",
      result,
    };

  } catch (error) {

    /*
    |--------------------------------------------------------------------------
    | 7. Mark FAILED
    |--------------------------------------------------------------------------
    */

    const durationMs = Date.now() - startedAt;

    console.error(
      `[CRON] ${job.job_code} failed:`,
      error
    );

    if (executionId) {
      await client.query(
        `
        UPDATE cron_job_executions
        SET
          status = 'FAILED',
          completed_at = NOW(),
          duration_ms = $1,
          error_message = $2
        WHERE id = $3
        `,
        [
          durationMs,
          error.message,
          executionId,
        ]
      );
    }

    return {
      status: "FAILED",
      error: error.message,
    };

  } finally {

    /*
    |--------------------------------------------------------------------------
    | 8. Release advisory lock
    |--------------------------------------------------------------------------
    */

    try {
      if (locked) {
        await client.query(
          `
          SELECT pg_advisory_unlock(hashtext($1))
          `,
          [job.job_code]
        );
      }
    } catch (unlockError) {
      console.error(
        `[CRON] ${job.job_code} unlock error:`,
        unlockError.message
      );
    }

    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| Register Job
|--------------------------------------------------------------------------
*/

async function registerJob(job) {

  /*
  |--------------------------------------------------------------------------
  | Validate handler
  |--------------------------------------------------------------------------
  */

  const handler = jobHandlers[job.job_code];

  if (!handler) {
    console.error(
      `[CRON] No handler found for ${job.job_code}`
    );

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Validate cron expression
  |--------------------------------------------------------------------------
  */

  if (!cron.validate(job.cron_expression)) {
    console.error(
      `[CRON] Invalid cron expression for ${job.job_code}:`,
      job.cron_expression
    );

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Stop old schedule first
  |--------------------------------------------------------------------------
  */

  stopJob(job.job_code);


  /*
  |--------------------------------------------------------------------------
  | Create new schedule
  |--------------------------------------------------------------------------
  */

  const task = cron.schedule(
    job.cron_expression,
    async () => {
      await executeJob(job, "scheduled");
    },
    {
      timezone:
        job.timezone || DEFAULT_TIMEZONE,
    }
  );


  activeJobs.set(
    job.job_code,
    task
  );


  console.log(
    `[CRON] Registered: ${job.job_code} -> ${job.cron_expression} (${job.timezone})`
  );


  /*
  |--------------------------------------------------------------------------
  | Run on startup
  |--------------------------------------------------------------------------
  */

  if (job.run_on_startup) {

    console.log(
      `[CRON] Running ${job.job_code} on startup`
    );

    await executeJob(
      job,
      "startup"
    );
  }
}


/*
|--------------------------------------------------------------------------
| Load all jobs from DB
|--------------------------------------------------------------------------
*/

async function loadSchedules() {

  const result = await db.query(
    `
    SELECT
      id,
      job_code,
      job_name,
      description,
      cron_expression,
      timezone,
      is_enabled,
      run_on_startup,
      retry_enabled,
      max_retries,
      created_by,
      updated_by,
      created_at,
      updated_at
    FROM cron_jobs
    WHERE is_enabled = TRUE
    ORDER BY id
    `
  );


  console.log(
    `[CRON] Found ${result.rows.length} enabled jobs`
  );


  for (const job of result.rows) {
    try {
      await registerJob(job);
    } catch (error) {
      console.error(
        `[CRON] Failed to register ${job.job_code}:`,
        error.message
      );
    }
  }
}


/*
|--------------------------------------------------------------------------
| Reload one job from DB
|--------------------------------------------------------------------------
|
| This is important for your future PUT/PATCH API.
|
*/

async function reloadJob(jobId) {

  const result = await db.query(
    `
    SELECT *
    FROM cron_jobs
    WHERE id = $1
    `,
    [jobId]
  );


  if (!result.rows.length) {
    throw new Error(
      `Cron job ${jobId} not found`
    );
  }


  const job = result.rows[0];


  /*
  |--------------------------------------------------------------------------
  | If disabled -> stop it
  |--------------------------------------------------------------------------
  */

  if (!job.is_enabled) {

    stopJob(job.job_code);

    console.log(
      `[CRON] Job disabled: ${job.job_code}`
    );

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Re-register updated schedule
  |--------------------------------------------------------------------------
  */

  await registerJob(job);
}


/*
|--------------------------------------------------------------------------
| Get currently registered jobs
|--------------------------------------------------------------------------
*/

function getActiveJobs() {

  return Array.from(
    activeJobs.keys()
  );
}


/*
|--------------------------------------------------------------------------
| Check whether a job is active
|--------------------------------------------------------------------------
*/

function isJobActive(jobCode) {
  return activeJobs.has(jobCode);
}


/*
|--------------------------------------------------------------------------
| Manual execution
|--------------------------------------------------------------------------
*/

async function runJobManually(jobId) {

  const result = await db.query(
    `
    SELECT *
    FROM cron_jobs
    WHERE id = $1
    `,
    [jobId]
  );


  if (!result.rows.length) {
    throw new Error(
      `Cron job ${jobId} not found`
    );
  }


  const job = result.rows[0];


  return await executeJob(
    job,
    "manual"
  );
}


module.exports = {
  loadSchedules,
  registerJob,
  stopJob,
  reloadJob,
  executeJob,
  runJobManually,
  getActiveJobs,
  isJobActive,
};