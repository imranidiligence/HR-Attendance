const express = require("express");
const router = express.Router();

const {
  listJobs,
  getJob,
  createJob,
  updateJob,
  toggleJob,
  deleteJob,
  runNow,
  getExecutions,
} = require("../controllers/cronJobs.controller");

// const { requireAuth, requireAdmin } = require("../middleware/auth"); // add if you have these
// router.use(requireAuth, requireAdmin);

router.get("/", listJobs);
router.get("/:id", getJob);
router.post("/", createJob);
router.put("/:id", updateJob);
router.patch("/:id/toggle", toggleJob);
router.delete("/:id", deleteJob);
router.post("/:id/run", runNow);
router.get("/:id/executions", getExecutions);

module.exports = router;