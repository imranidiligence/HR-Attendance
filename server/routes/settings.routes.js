const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { db } = require("../db/connectDB");
const { getSettings, getSettingByKey } = require("../controllers/settings.controller");
const router = express.Router();

router.get("/get-all-settings", authMiddleware, getSettings);
router.get("/get-setting/:key", authMiddleware, getSettingByKey);
module.exports = router;