const express = require("express");
const router = express.Router();

const leaveProcessController = require("../controllers/leaveProcessController");
const auth = require("../middlewares/authMiddleware");

// ============================================================
// EMPLOYEE SELF-SERVICE APIs
// ============================================================


router.get("/my-summary", auth,leaveProcessController.getMyLeaveSummary);

router.get(
    "/all-summary",
    auth,
    leaveProcessController.getAllEmployeesLeaveSummary
);

// Get leave types applicable to logged-in employee
router.get(
    "/my-leave-types",
    auth,
    leaveProcessController.getMyLeaveTypes
);


router.put(
    "/request/:id/edit",
    auth,
    leaveProcessController.editLeave
);


// Get leave balance/quota of logged-in employee
router.get(
    "/my-balance",
    auth,
    leaveProcessController.getMyLeaveBalance
);

// Get leave dashboard of logged-in employee
router.get(
    "/dashboard",
    auth,
    leaveProcessController.getLeaveDashboard
);

// Apply for leave
router.post(
    "/apply",
    auth,
    leaveProcessController.applyLeave
);

// Get logged-in employee's leave requests
router.get(
    "/my-requests",
    auth,
    leaveProcessController.getMyLeaveRequests
);

router.get(
    "/my-reporting-details",
    auth,
    leaveProcessController.getMyReportingDetails
);

router.get(
    "/manager/requests",
    auth,
    leaveProcessController.getManagerLeaveRequests
);

// Get logged-in employee's particular leave request
router.get(
    "/request/:id",
    auth,
    leaveProcessController.getLeaveRequestById
);

// Cancel logged-in employee's leave request
router.post(
    "/request/:id/cancel",
    auth,
    leaveProcessController.cancelLeave
);


// ============================================================
// APPROVER / MANAGER APIs
// ============================================================

// Get pending leave requests assigned to logged-in approver
router.get(
    "/approvals/pending",
    auth,
    leaveProcessController.getPendingApprovals
);

// Approve leave request
router.post(
    "/request/:id/approve",
    auth,
    leaveProcessController.approveLeave
);

// Reject leave request
router.post(
    "/request/:id/reject",
    auth,
    leaveProcessController.rejectLeave
);


// ============================================================
// HR / ADMIN APIs
// ============================================================

// Get all leave requests
router.get(
    "/all-requests",
    auth,
    leaveProcessController.getAllLeaveRequests
);

// Get employee leave balance
router.get(
    "/employee/:prId/balance",
    auth,
    leaveProcessController.getEmployeeLeaveBalance
);

// Get employee leave requests
router.get(
    "/employee/:prId/requests",
    auth,
    leaveProcessController.getEmployeeLeaveRequests
);


module.exports = router;