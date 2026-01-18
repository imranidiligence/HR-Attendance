const express = require("express");
const cors = require("cors");
const ZKLib = require("zklib-js");
const {Client} = require("pg");
const {connectDB,db} = require("./db/connectDB");
const userRoutes = require("./routes/user.routes");
const employRoutes = require("./routes/employ.routes");
const profileRoutes = require("./routes/profile.routes");
const attendanceRoutes = require("./routes/attendance.routes")
const adminRoutes = require("./routes/admin.routes");
require("./cron/attendance.cron");
require("dotenv").config();

const app = express();



const PORT = process.env.PORT || 5500;


app.use(express.json());

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  

// Auth Routes
app.use("/api/auth",userRoutes);
// app.use("/employee-dashboard",employRoutes);

// Employee Routes
app.use("/api/employee/attendance", employRoutes);

// Employee Profile Routes

app.use("/api/employee/profile",profileRoutes);

// Admin Routes
app.use("/api/admin/attendance", attendanceRoutes);
// app.use("/admin-dashboard",adminRoutes)



app.listen(PORT,()=>{

    console.log(`Server Running on PORT ${PORT}`);
    connectDB();

})



// (async () => {
//   const zk = new ZKLib("192.168.0.10", 4370, 10000, 4000);

//   try {
//     await zk.createSocket();
//     console.log("✅ Connected");

//     // 🔑 VERY IMPORTANT
//     await zk.enableDevice();
//     console.log("✅ Device Enabled");

//     const serial = await zk.getSerialNumber();
//     console.log("📟 Serial:", serial);

//     const attendance = await zk.getAttendances();

//     console.log("📄 Attendance Data:");
//     console.log(attendance);

   
//     await zk.disconnect();
//   } catch (err) {
//     console.error("❌ Error:", err.message);
//   }
// })();

// setInterval(async () => {
//   try {
//     await zk.enableDevice(); // ALWAYS before fetch

//     const logs = await zk.getAttendances();

//     console.log("📥 Count:", logs?.data?.length || 0);

//     if (!logs?.data?.length) return;

//     for (const log of logs.data) {
//       console.log("✅ Attendance:", log);
//     }
//   } catch (err) {
//     console.error("❌ Fetch error:", err.message);
//   }
// }, 5000);


  
