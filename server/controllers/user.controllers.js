const jwt = require("jsonwebtoken");

const bcrypt = require("bcrypt");
const { db } = require("../db/connectDB");



  


const loginController = async (req, res) => {
  try {
    let { email:identifier, password } = req.body;

    // console.log(email,password);

    
    if (!identifier || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    
    identifier = identifier.trim().toLowerCase();
    password = String(password).trim()

  
    const result = await db.query(
      `SELECT id, name, email, password, role, emp_id 
       FROM users 
       WHERE email = $1 OR emp_id = $2`,
      [identifier,identifier]
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
      { expiresIn: "1h" } // token 1 ghante ke liye valid
    );
    
    // Decode token to get exact expiry timestamp (optional)
    const decoded = jwt.decode(token); // decoded.exp gives expiry in seconds
    
    res.status(200).json({
      message: "Login successful",
      token,
      expiresAt: decoded.exp * 1000, // expiry in milliseconds
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




module.exports = { loginController,changeMyPassword };