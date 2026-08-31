const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { db } = require("../db/connectDB");
const sendEmail = require("../utils/mailer");

// ======================================================
// Generate 6 digit OTP
// ======================================================
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// ======================================================
// SEND PASSWORD RESET OTP
//
// POST /forgot-password
//
// Body:
// {
//   "email": "john.doe@example.com"
// }
// ======================================================
const sendPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find account using organization official email
    const result = await db.query(
      `
      SELECT
        or_id,
        pr_id,
        or_official_email,
        or_organization_name
      FROM organizations
      WHERE LOWER(or_official_email) = $1
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    const organization = result.rows[0];

    // Check whether login account exists
    const loginResult = await db.query(
      `
      SELECT
        lg_id,
        pr_id
      FROM login
      WHERE pr_id = $1
      LIMIT 1
      `,
      [organization.pr_id]
    );

    if (loginResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Login account not found",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Hash OTP before storing
    const otpHash = await bcrypt.hash(otp, 10);

    // OTP valid for 10 minutes
    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // Save OTP
    await db.query(
      `
      UPDATE organizations
      SET
        password_reset_otp_hash = $1,
        password_reset_otp_expires_at = $2
      WHERE or_id = $3
      `,
      [
        otpHash,
        expiresAt,
        organization.or_id,
      ]
    );

    // Send email
    await sendEmail(
      organization.or_official_email,
      "Password Reset OTP - I-Diligence Solution",
      "password_reset_otp",
      {
        name:
          organization.or_organization_name || "User",
        otp,
      }
    );

    return res.status(200).json({
      success: true,
      message: "OTP has been sent to your registered email",
    });
  } catch (error) {
    console.error(
      "sendPasswordResetOtp error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to send password reset OTP",
    });
  }
};

// ======================================================
// RESET PASSWORD
//
// POST /reset-password
//
// Body:
// {
//   "email": "john.doe@example.com",
//   "otp": "123456",
//   "newPassword": "NewPassword@123"
// }
// ======================================================
const resetPassword = async (req, res) => {
  try {
    const {
      email,
      otp,
      newPassword,
    } = req.body;

    // ==================================================
    // Validate request
    // ==================================================
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Email, OTP and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ==================================================
    // Find employee using organization email
    // Also get password from login table
    // ==================================================
    const result = await db.query(
      `
      SELECT
        o.employee_id,
        o.or_official_email,
        o.password_reset_otp_hash,
        o.password_reset_otp_expires_at,
        l.lg_password
      FROM organizations o
      LEFT JOIN login l
        ON l.lg_employee_id = o.employee_id
      WHERE LOWER(o.or_official_email) = $1
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    // ==================================================
    // Check OTP exists
    // ==================================================
    if (
      !user.password_reset_otp_hash ||
      !user.password_reset_otp_expires_at
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OTP not found. Please request a new OTP",
      });
    }

    // ==================================================
    // Check OTP expiry
    // ==================================================
    const currentTime = new Date();
    const expiryTime = new Date(
      user.password_reset_otp_expires_at
    );

    if (currentTime > expiryTime) {
      await db.query(
        `
        UPDATE organizations
        SET
          password_reset_otp_hash = NULL,
          password_reset_otp_expires_at = NULL
        WHERE employee_id = $1
        `,
        [user.employee_id]
      );

      return res.status(400).json({
        success: false,
        message:
          "OTP has expired. Please request a new OTP",
      });
    }

    // ==================================================
    // Verify OTP
    // ==================================================
    const validOtp = await bcrypt.compare(
      otp.toString(),
      user.password_reset_otp_hash
    );

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // ==================================================
    // Hash new password
    // ==================================================
    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    // ==================================================
    // Update password in LOGIN table
    // ==================================================
    const updatePasswordResult = await db.query(
      `
      UPDATE login
      SET lg_password = $1
      WHERE lg_employee_id = $2
      RETURNING lg_employee_id
      `,
      [
        hashedPassword,
        user.employee_id,
      ]
    );

    if (updatePasswordResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Login account not found",
      });
    }

    // ==================================================
    // Clear OTP after successful password reset
    // ==================================================
    await db.query(
      `
      UPDATE organizations
      SET
        password_reset_otp_hash = NULL,
        password_reset_otp_expires_at = NULL
      WHERE employee_id = $1
      `,
      [user.employee_id]
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("resetPassword error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

// ======================================================
// CHANGE PASSWORD
//
// POST /change-password
//
// Requires authMiddleware
//
// Body:
// {
//   "newPassword": "NewPassword@123"
// }
//
// NOTE:
// No old/current password is required.
// ======================================================
const changeMyPassword = async (req, res) => {
  try {
    // ==================================================
    // Get logged-in employee/user ID
    // ==================================================
    const employeeId = req.user?.id;

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { newPassword } = req.body;

    // ==================================================
    // Validate new password
    // ==================================================
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters long",
      });
    }

    // ==================================================
    // Hash new password
    // ==================================================
    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    // ==================================================
    // Update password in LOGIN table
    //
    // No comparison with old password
    // ==================================================
    const result = await db.query(
      `
      UPDATE login
      SET lg_password = $1
      WHERE lg_employee_id = $2
      RETURNING lg_employee_id
      `,
      [
        hashedPassword,
        employeeId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Login account not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("changeMyPassword error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while changing password",
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================
module.exports = {
  sendPasswordResetOtp,
  resetPassword,
  changeMyPassword,
};