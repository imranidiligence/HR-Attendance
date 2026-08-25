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

    // Find user
    const result = await db.query(
      `
      SELECT id, name, email
      FROM users
      WHERE LOWER(email) = $1
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

    const user = result.rows[0];

    // Generate OTP
    const otp = generateOTP();

    // Hash OTP before storing
    const otpHash = await bcrypt.hash(otp, 10);

    // OTP expires after 10 minutes
    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    // Save OTP
    await db.query(
      `
      UPDATE users
      SET
        password_reset_otp_hash = $1,
        password_reset_otp_expires_at = $2
      WHERE id = $3
      `,
      [
        otpHash,
        expiresAt,
        user.id,
      ]
    );

    // Send OTP email using your existing mailer
    await sendEmail(
      user.email,
      "Password Reset OTP - I-Diligence Solution",
      "password_reset_otp",
      {
        name: user.name || "User",
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

    // Find user
    const result = await db.query(
      `
      SELECT
        id,
        password,
        password_reset_otp_hash,
        password_reset_otp_expires_at
      FROM users
      WHERE LOWER(email) = $1
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

    // Check OTP exists
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

    // Check OTP expiry
    const currentTime = new Date();
    const expiryTime = new Date(
      user.password_reset_otp_expires_at
    );

    if (currentTime > expiryTime) {

      // Clear expired OTP
      await db.query(
        `
        UPDATE users
        SET
          password_reset_otp_hash = NULL,
          password_reset_otp_expires_at = NULL
        WHERE id = $1
        `,
        [user.id]
      );

      return res.status(400).json({
        success: false,
        message:
          "OTP has expired. Please request a new OTP",
      });
    }

    // Verify OTP
    const validOtp = await bcrypt.compare(
      otp,
      user.password_reset_otp_hash
    );

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Prevent using the same password
    if (user.password) {
      const samePassword = await bcrypt.compare(
        newPassword,
        user.password
      );

      if (samePassword) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be different from your old password",
        });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    // Update password and clear OTP
    await db.query(
      `
      UPDATE users
      SET
        password = $1,
        password_reset_otp_hash = NULL,
        password_reset_otp_expires_at = NULL
      WHERE id = $2
      `,
      [
        hashedPassword,
        user.id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });

  } catch (error) {
    console.error(
      "resetPassword error:",
      error
    );

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
//   "currentPassword": "OldPassword@123",
//   "newPassword": "NewPassword@123"
// }
// ======================================================

const changeMyPassword = async (req, res) => {
  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters long",
      });
    }

    // Get current password
    const result = await db.query(
      `
      SELECT id, password
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    // Verify current password
    const isPasswordCorrect =
      await bcrypt.compare(
        currentPassword,
        user.password
      );

    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Prevent same password
    const isSamePassword =
      await bcrypt.compare(
        newPassword,
        user.password
      );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from current password",
      });
    }

    // Hash new password
    const hashedPassword =
      await bcrypt.hash(newPassword, 12);

    await db.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
      `,
      [
        hashedPassword,
        userId,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });

  } catch (error) {

    console.error(
      "changeMyPassword error:",
      error
    );

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