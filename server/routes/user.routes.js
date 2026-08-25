const express = require('express');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("../db/connectDB");
const { add, loginController,  getAllEmployees, getAllEmployeesPaginated, getCountOfEmployees, updateUserActiveOrInActiveStatus } = require('../controllers/user.controllers');
const authMiddleware = require('../middlewares/authMiddleware');
require("dotenv").config();
const { sendPasswordResetOtp, resetPassword, changeMyPassword} = require("../controllers/password.controller")
const router = express.Router();


// Login Routes

router.post("/login", loginController);
  

router.get("/employees", authMiddleware, getAllEmployeesPaginated);

router.get("/employees/all", authMiddleware, getCountOfEmployees);

router.put(
  "/users/:id/status",
  updateUserActiveOrInActiveStatus
);
// Change Password

router.post("/forgot-password", sendPasswordResetOtp);
router.post("/reset-password", resetPassword);

router.post("/change-password", authMiddleware, changeMyPassword);


module.exports = router;