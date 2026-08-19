const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
// const path = require("path")
// const dotenv = require("dotenv")
const ZKLib = require("zklib-js");
const { Client } = require("pg");
const http = require("http"); // 1. Import http
const { Server } = require("socket.io");
const { connectDB, db } = require("./db/connectDB");
const userRoutes = require("./routes/user.routes");
const employRoutes = require("./routes/employ.routes");
const profileRoutes = require("./routes/profile.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const shiftRoutes = require("./routes/shifts.routes");
const reportingRoutes = require("./routes/reporting.routes");
const leavesRoutes = require("./routes/leave.routes");
const settingsRoutes = require("./routes/settings.routes");
const departmentRoutes = require('./routes/departmentRoutes');
const designationRoutes = require('./routes/designationRoutes');
const employeeTypeRoutes = require('./routes/employeeTypeRoutes');
const contactTypeRoutes = require('./routes/contactTypeRoutes');
const nationalityRoutes = require('./routes/nationalityRoutes');
const genderRoutes = require('./routes/genderRoutes');
const maritalStatusRoutes = require('./routes/maritalStatusRoutes');
const documentTypeRoutes = require('./routes/documentTypeRoutes');
const countryRoutes = require('./routes/countryRoutes');
const bloodGroupRoutes = require('./routes/bloodGroupRoutes');
const stateRoutes = require('./routes/stateRoutes');
const cityRoutes = require('./routes/cityRoutes');
const branchRoutes = require('./routes/branchRoutes');
const branchLocationRoutes = require('./routes/branchLocationRoutes');
const vendorTypeRoutes = require('./routes/vendorTypeRoutes');
const cronRoutes = require("./routes/cron.routes");
const vendorDetailsRoutes = require('./routes/vendorDetailsRoutes');
const degreeRoutes = require('./routes/degreeRoutes')
const bankAccountTypeRoutes = require('./routes/bankAccountTypeRoutes')
// const adminRoutes = require("./routes/admin.routes");
require("./cron/attendance.cron");
// require("dotenv").config();
const path = require("path");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
console.log("CLIENT_URL =", process.env.CLIENT_URL);
const app = express();

const PORT = process.env.PORT || 5500;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

// 5. Track Connected Users (Map emp_id -> socket_id)
const userSockets = new Map();

io.on("connection", (socket) => {
  const empId = socket.handshake.query.empId;
  if (empId) {
    userSockets.set(empId.toString(), socket.id);

    console.log(` Socket: User ${empId} connected on ${socket.id}`);
  }

  socket.on("disconnect", () => {
    userSockets.delete(empId?.toString());
    console.log(`Socket: User ${empId} disconnected`);
  });
});

// 6. Middleware to make 'io' and 'userSockets' accessible in routes
app.use((req, res, next) => {
  req.io = io;
  req.userSockets = userSockets;
  next();
});
app.use(express.json());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Auth Routes
app.use("/api/auth", userRoutes);
// app.use("/employee-dashboard",employRoutes);

// Employee Routes
app.use("/api/employee/attendance", employRoutes);

// Employee Profile Routes

app.use("/api/employee/profile", profileRoutes);

// Admin Routes
app.use("/api/admin/attendance", attendanceRoutes);
// app.use("/admin-dashboard",adminRoutes)

// Shifts Routs
app.use("/api/admin/shifts", shiftRoutes);

// Reporting
app.use("/api", reportingRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/employee-types', employeeTypeRoutes);
app.use('/api/contact-types', contactTypeRoutes);
app.use('/api/nationalities', nationalityRoutes);
app.use('/api/genders', genderRoutes);
app.use('/api/marital-statuses', maritalStatusRoutes);
app.use('/api/document-types', documentTypeRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/states', stateRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/blood-groups', bloodGroupRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/branch-locations', branchLocationRoutes);
app.use('/vendor-details', vendorDetailsRoutes);
app.use('/api/vendor-types', vendorTypeRoutes);
app.use('/api/degrees', degreeRoutes);
app.use('/api/bank-account-types', bankAccountTypeRoutes);
// Leaves

app.use("/api/leaves/types", leavesRoutes);
app.use("/api/settings", settingsRoutes);

// Cron Schedule Route

//Dashboard 
app.use("/api/dashboard", dashboardRoutes);

app.use("/api/update-schedule", cronRoutes);
server.listen(PORT, async () => {
  try {
    await connectDB();
    console.log(`✅ Server Running on PORT ${PORT}`);
  } catch (err) {
    console.error("Database connection failed:", err);
  }
});
