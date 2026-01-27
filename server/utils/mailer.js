const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // replace with your provider
  port: 587,
  secure: false, // use TLS
  auth: {
    user: process.env.MAILNAME,
    pass: process.env.MAILPASS,
  },
});

// Function to send email
const sendEmail = async (to, subject, templateName, templateData) => {
  try {
    const templatePath = path.join(__dirname, "../email_templates", `${templateName}.html`);
    let html = fs.readFileSync(templatePath, "utf8");

    for (const key in templateData) {
      html = html.replace(new RegExp(`{{${key}}}`, "g"), templateData[key]);
    }

    await transporter.sendMail({
      from: `"I-Deiligence Solution" <${process.env.MAILNAME}>`,
      to,
      subject,
      html,
    });

    console.log(`Email sent to ${to} with subject: ${subject}`);
  } catch (err) {
    console.error("Error sending email:", err);
  }
};

module.exports = sendEmail;
