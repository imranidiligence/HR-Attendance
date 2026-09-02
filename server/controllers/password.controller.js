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

    // --------------------------------------------------
    // Validate email
    // --------------------------------------------------
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------
    // Find account using organization official email
    //
    // organizations.pr_id -> personal.pr_id
    // --------------------------------------------------
    const result = await db.query(
      `
      SELECT
        o.or_id,
        o.pr_id,
        o.or_official_email,
        o.or_organization_name
      FROM organizations o
      WHERE LOWER(o.or_official_email) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    const organization = result.rows[0];

    // --------------------------------------------------
    // Check login account
    //
    // login.pr_id = organizations.pr_id
    // --------------------------------------------------
    const loginResult = await db.query(
      `
      SELECT
        lg_id,
        pr_id
      FROM login
      WHERE pr_id = $1
      LIMIT 1
      `,
      [organization.pr_id],
    );

    if (loginResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Login account not found",
      });
    }

    // --------------------------------------------------
    // Generate OTP
    // --------------------------------------------------
    const otp = generateOTP();

    // --------------------------------------------------
    // Hash OTP
    // --------------------------------------------------
    const otpHash = await bcrypt.hash(otp, 10);

    // --------------------------------------------------
    // OTP expires after 10 minutes
    // --------------------------------------------------
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // --------------------------------------------------
    // Insert / update resetpassword
    //
    // Because pr_id is UNIQUE:
    // - first request -> INSERT
    // - next request -> UPDATE
    // --------------------------------------------------
    await db.query(
      `
      INSERT INTO resetpassword
      (
        pr_id,
        rp_otp_hash,
        rp_otp_expires_at,
        rp_created_at,
        rp_updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())

      ON CONFLICT (pr_id)
      DO UPDATE SET
        rp_otp_hash = EXCLUDED.rp_otp_hash,
        rp_otp_expires_at = EXCLUDED.rp_otp_expires_at,
        rp_updated_at = NOW()
      `,
      [organization.pr_id, otpHash, expiresAt],
    );

    // --------------------------------------------------
    // Send OTP email
    // --------------------------------------------------
    await sendEmail(
      organization.or_official_email,
      "Password Reset OTP - I-Diligence Solution",
      "password_reset_otp",
      {
        name: organization.or_organization_name || "User",
        otp,
      },
    );

    return res.status(200).json({
      success: true,
      message: "OTP has been sent to your registered email",
    });
  } catch (error) {
    console.error("sendPasswordResetOtp error:", error);

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
    const { email, otp, newPassword } = req.body;

    // --------------------------------------------------
    // Validate request
    // --------------------------------------------------
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP and new password are required",
      });
    }

    // --------------------------------------------------
    // Password validation
    // --------------------------------------------------
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------
    // Find organization + reset request + login
    // --------------------------------------------------
    const result = await db.query(
      `
      SELECT
        o.or_id,
        o.pr_id,
        o.or_official_email,
        o.or_organization_name,

        r.rp_otp_hash,
        r.rp_otp_expires_at,

        l.lg_id

      FROM organizations o

      INNER JOIN resetpassword r
        ON r.pr_id = o.pr_id

      INNER JOIN login l
        ON l.pr_id = o.pr_id

      WHERE LOWER(o.or_official_email) = $1

      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No password reset request found for this email",
      });
    }

    const user = result.rows[0];

    // --------------------------------------------------
    // Check OTP exists
    // --------------------------------------------------
    if (!user.rp_otp_hash || !user.rp_otp_expires_at) {
      return res.status(400).json({
        success: false,
        message: "OTP not found. Please request a new OTP",
      });
    }

    // --------------------------------------------------
    // Check OTP expiry
    // --------------------------------------------------
    const currentTime = new Date();
    const expiryTime = new Date(user.rp_otp_expires_at);

    if (currentTime > expiryTime) {
      await db.query(
        `
        DELETE FROM resetpassword
        WHERE pr_id = $1
        `,
        [user.pr_id],
      );

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP",
      });
    }

    // --------------------------------------------------
    // Verify OTP
    // --------------------------------------------------
    const validOtp = await bcrypt.compare(
      otp.toString(),
      user.rp_otp_hash,
    );

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // --------------------------------------------------
    // Hash new password
    // --------------------------------------------------
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // --------------------------------------------------
    // Update password
    // --------------------------------------------------
    const updateResult = await db.query(
      `
      UPDATE login
      SET
        lg_password = $1,
        lg_updated_at = NOW()
      WHERE pr_id = $2
      RETURNING lg_id
      `,
      [hashedPassword, user.pr_id],
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Unable to update password",
      });
    }

    // --------------------------------------------------
    // Delete OTP after successful reset
    // --------------------------------------------------
    await db.query(
      `
      DELETE FROM resetpassword
      WHERE pr_id = $1
      `,
      [user.pr_id],
    );

    // --------------------------------------------------
    // Send password reset success email
    // --------------------------------------------------
    try {
      await sendEmail(
        user.or_official_email,
        "Password Reset Successful - I-Diligence Solution",
        "password_reset_success",
        {
          name: user.or_organization_name || "User",
          email: user.or_official_email,
          resetTime: new Date().toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          }),
        },
      );
    } catch (emailError) {
      // Password was already changed successfully.
      // Don't return 500 just because email failed.
      console.error(
        "Password reset success email error:",
        emailError,
      );
    }

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
// No old password required.
// ======================================================
const changeMyPassword = async (req, res) => {
  try {
    const { pr_id, newPassword } = req.body;

    // Validate pr_id
    if (!pr_id) {
      return res.status(400).json({
        success: false,
        message: "pr_id is required",
      });
    }

    // Validate new password
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    // Check login account using pr_id
    const loginResult = await db.query(
      `
      SELECT
        lg_id,
        pr_id
      FROM login
      WHERE pr_id = $1
      LIMIT 1
      `,
      [pr_id],
    );

    if (loginResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Login account not found",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.query(
      `
      UPDATE login
      SET
        lg_password = $1,
        lg_updated_at = NOW()
      WHERE pr_id = $2
      `,
      [hashedPassword, pr_id],
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("changeMyPassword error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while changing password",
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
