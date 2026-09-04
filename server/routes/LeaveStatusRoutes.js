const express = require("express");

const router = express.Router();

const {
  createLeaveStatus,
  getLeaveStatusById,
  getAllLeaveStatuses,
  getPaginatedLeaveStatuses,
  updateLeaveStatus,
  deleteLeaveStatus
} = require("../controllers/leaveStatusController");


// Create Leave Status
router.post(
  "/",
  createLeaveStatus
);


// Get Paginated Leave Statuses
// Must come before /:id
router.get(
  "/paginated",
  getPaginatedLeaveStatuses
);


// Get All Leave Statuses
router.get(
  "/",
  getAllLeaveStatuses
);


// Get Leave Status By ID
router.get(
  "/:id",
  getLeaveStatusById
);


// Update Leave Status
router.put(
  "/:id",
  updateLeaveStatus
);


// Activate / Deactivate Leave Status
router.delete(
  "/:id",
  deleteLeaveStatus
);


module.exports = router;