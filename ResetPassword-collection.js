{
  "info": {
    "_postman_id": "8d6f7e3a-9b22-4c91-a4b5-ids-hr-password",
    "name": "IDS HR - Password APIs",
    "description": "Password management APIs for IDS HR: forgot password OTP, reset password, and change password.",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5000",
      "type": "string"
    },
    {
      "key": "email",
      "value": "employee@example.com",
      "type": "string"
    },
    {
      "key": "pr_id",
      "value": "41",
      "type": "string"
    },
    {
      "key": "otp",
      "value": "",
      "type": "string"
    },
    {
      "key": "newPassword",
      "value": "NewPassword@123",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Password Management",
      "item": [
        {
          "name": "1. Forgot Password - Send OTP",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{email}}\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/forgot-password",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "forgot-password"
              ]
            },
            "description": "Sends a 6-digit OTP to the employee's official email stored in organizations.or_official_email."
          },
          "response": []
        },
        {
          "name": "2. Reset Password - OTP",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"{{email}}\",\n  \"otp\": \"{{otp}}\",\n  \"newPassword\": \"{{newPassword}}\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/reset-password",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "reset-password"
              ]
            },
            "description": "Verifies the OTP and updates login.lg_password."
          },
          "response": []
        },
        {
          "name": "3. Change Password - pr_id",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"pr_id\": {{pr_id}},\n  \"newPassword\": \"{{newPassword}}\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/change-password",
              "host": [
                "{{baseUrl}}"
              ],
              "path": [
                "api",
                "auth",
                "change-password"
              ]
            },
            "description": "Changes the password directly using pr_id. Does not require the old password."
          },
          "response": []
        }
      ]
    }
  ]
}