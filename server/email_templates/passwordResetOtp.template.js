const passwordResetOtpTemplate = ({
  name,
  otp,
  expiresInMinutes = 10,
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />

  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f4f6f8;
      font-family: Arial, Helvetica, sans-serif;
    }

    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }

    .header {
      background: #2563eb;
      color: white;
      padding: 25px;
      text-align: center;
    }

    .content {
      padding: 35px;
      color: #333333;
    }

    .otp {
      margin: 25px auto;
      padding: 18px;
      background: #f3f4f6;
      border-radius: 8px;
      text-align: center;
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #2563eb;
      width: fit-content;
    }

    .warning {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
    }

    .footer {
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #888;
      background: #f9fafb;
    }
  </style>
</head>

<body>

  <div class="container">

    <div class="header">
      <h2>Password Reset</h2>
    </div>

    <div class="content">

      <p>Hello ${name || "User"},</p>

      <p>
        We received a request to reset your password.
        Use the OTP below to continue.
      </p>

      <div class="otp">
        ${otp}
      </div>

      <p>
        This OTP will expire in
        <strong>${expiresInMinutes} minutes</strong>.
      </p>

      <p class="warning">
        If you did not request a password reset, please ignore this email.
        Do not share this OTP with anyone.
      </p>

    </div>

    <div class="footer">
      © ${new Date().getFullYear()} IDS HR. All rights reserved.
    </div>

  </div>

</body>
</html>
`;
};

module.exports = passwordResetOtpTemplate;