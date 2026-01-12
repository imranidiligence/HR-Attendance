const jwt = require("jsonwebtoken");

const bcrypt = require("bcrypt");
const { db } = require("../db/connectDB");


const addEmployController = async (req, res) => {
  try {
    let { name, email, password, role,emp_id } = req.body;


    // console.log(name,email,password,role,emp_id)
    //  Validation

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    //  Normalize
    email = email.toLowerCase().trim();
    password = String(password); //  FIX
    role = role || "employee";   //  DEFAULT ROLE

    //  Check existing user
    const userExist = await db.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    //  Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    //  Insert user
    const newUser = await db.query(
      `
      INSERT INTO users (name, email, password, role, emp_id)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, name, email, role
      `,
      [name, email, hashedPassword, role,emp_id || null]
    );

    res.status(201).json({
      message: "User Registered Successfully",
      user: newUser.rows[0],
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

  


const loginController = async (req, res) => {
  try {
    let { email, password } = req.body;

    // console.log(email,password);

    
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    
    email = email.trim().toLowerCase();
    password = String(password).trim()

  
    const result = await db.query(
      `SELECT id, name, email, password, role, emp_id 
       FROM users 
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];


    // console.log("user",user);
    
    const isMatch = await bcrypt.compare(password, user.password);
    // console.log("isMatch",isMatch);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }


    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        emp_id: user.emp_id
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

  
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emp_id: user.emp_id
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};




const changeMyPassword = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Get current password hash
    const result = await db.query(
      "SELECT password FROM users WHERE id = $1",
      [employeeId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }
    // console.log("currentPassword",currentPassword)
    // console.log("result.rows[0].password",result.rows[0].password);
    
    // Compare current password
    const isMatch = await bcrypt.compare(
      currentPassword,
      result.rows[0].password
    );

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // console.log("newPassword",newPassword)
    // Hash new password
    const saltRounds = 10;
    const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.query(
      `UPDATE users
       SET password = $1,
          
          created_at = NOW()
       WHERE id = $2`,
      [newHashedPassword, employeeId]
    );

    return res.status(200).json({
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};




module.exports = { addEmployController, loginController,changeMyPassword };