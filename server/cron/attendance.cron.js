const {
  loadSchedules,
} = require("../cron/scheduler.manager");

(async () => {
  try {
    console.log(
      "[CRON] Initializing scheduler..."
    );

    await loadSchedules();

    console.log(
      "[CRON] Scheduler initialized successfully"
    );
  } catch (error) {
    console.error(
      "[CRON] Scheduler initialization failed:",
      error
    );
  }
})();