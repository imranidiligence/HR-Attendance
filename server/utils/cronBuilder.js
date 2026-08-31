/*
|--------------------------------------------------------------------------
| Schedule config shape (what the frontend sends instead of cron syntax)
|--------------------------------------------------------------------------
|
| { frequency: "daily", time: "11:00" }
| { frequency: "weekly", time: "11:00", days_of_week: [1,3,5] }   // 0=Sun..6=Sat
| { frequency: "monthly", time: "11:00", day_of_month: 1 }
| { frequency: "every_n_minutes", interval_minutes: 5 }
| { frequency: "every_n_hours", interval_hours: 2 }
|
*/

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTime(time) {
  if (!TIME_REGEX.test(time)) {
    throw new Error(`Invalid time format "${time}" — expected HH:mm (24-hour)`);
  }
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

function validateDaysOfWeek(days) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error("days_of_week must be a non-empty array");
  }
  for (const d of days) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new Error(`Invalid day_of_week value "${d}" — expected 0 (Sun) to 6 (Sat)`);
    }
  }
}

function validateDayOfMonth(day) {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid day_of_month "${day}" — expected 1 to 31`);
  }
}

function validateIntervalMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 59) {
    throw new Error(`Invalid interval_minutes "${minutes}" — expected 1 to 59`);
  }
}

function validateIntervalHours(hours) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 23) {
    throw new Error(`Invalid interval_hours "${hours}" — expected 1 to 23`);
  }
}

/*
|--------------------------------------------------------------------------
| Build a cron expression from a friendly schedule config
|--------------------------------------------------------------------------
*/
function buildCronExpression(config) {
  if (!config || typeof config !== "object") {
    throw new Error("schedule config is required");
  }

  switch (config.frequency) {
    case "daily": {
      const { hour, minute } = parseTime(config.time);
      return `${minute} ${hour} * * *`;
    }

    case "weekly": {
      const { hour, minute } = parseTime(config.time);
      validateDaysOfWeek(config.days_of_week);
      return `${minute} ${hour} * * ${config.days_of_week.join(",")}`;
    }

    case "monthly": {
      const { hour, minute } = parseTime(config.time);
      validateDayOfMonth(config.day_of_month);
      return `${minute} ${hour} ${config.day_of_month} * *`;
    }

    case "every_n_minutes": {
      validateIntervalMinutes(config.interval_minutes);
      return `*/${config.interval_minutes} * * * *`;
    }

    case "every_n_hours": {
      validateIntervalHours(config.interval_hours);
      return `0 */${config.interval_hours} * * *`;
    }

    default:
      throw new Error(`Unknown frequency "${config.frequency}"`);
  }
}

/*
|--------------------------------------------------------------------------
| Human-readable summary of a schedule config, for display in the job
| list — so the UI never needs to show or interpret raw cron syntax.
|--------------------------------------------------------------------------
*/
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describeSchedule(config) {
  if (!config || typeof config !== "object") return "Not scheduled";

  const formatTime = (time) => {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  };

  switch (config.frequency) {
    case "daily":
      return `Every day at ${formatTime(config.time)}`;

    case "weekly": {
      const days = [...config.days_of_week].sort().map((d) => DAY_NAMES[d]).join(", ");
      return `Every ${days} at ${formatTime(config.time)}`;
    }

    case "monthly":
      return `Day ${config.day_of_month} of every month at ${formatTime(config.time)}`;

    case "every_n_minutes":
      return `Every ${config.interval_minutes} minute${config.interval_minutes === 1 ? "" : "s"}`;

    case "every_n_hours":
      return `Every ${config.interval_hours} hour${config.interval_hours === 1 ? "" : "s"}`;

    default:
      return "Unknown schedule";
  }
}

module.exports = {
  buildCronExpression,
  describeSchedule,
};