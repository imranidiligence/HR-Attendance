const express = require('express');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("../db/connectDB");
const { add, loginController, changeMyPassword, getAllEmployees, getAllEmployeesPaginated, getCountOfEmployees } = require('../controllers/user.controllers');
const authMiddleware = require('../middlewares/authMiddleware');
require("dotenv").config();

const router = express.Router();



  
// Login Routes

router.post("/login", loginController);
  
// Change Password

router.post("/change-password",authMiddleware,changeMyPassword);

router.get("/employees", authMiddleware, getAllEmployeesPaginated);

router.get("/employees/all", authMiddleware, getCountOfEmployees);


module.exports = router;