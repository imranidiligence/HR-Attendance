const express = require("express");

const router = express.Router();

const {
    syncLeaveQuota
} = require("../controllers/LeaveQuotaController");

// Trigger leave quota synchronization
router.post(
    "/sync",
    syncLeaveQuota
);

module.exports = router;