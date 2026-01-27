// const { Client } = require("pg");
// require("dotenv").config();

// const db = new Client({
//   host: process.env.PSQL_HOST,
//   user: process.env.PSQL_USER,
//   port: process.env.PSQL_PORT,
//   password: process.env.PSQL_PASSWORD,
//   database: process.env.PSQL_DATABASE,
// });

// const connectDB = async () => {
//   try {
//     await db.connect();
//     console.log("PostgreSQL Connected (Client)");
//   } catch (err) {
//     console.error(" DB Connection Error:", err.message);
//     process.exit(1);
//   }
// };

// module.exports = { db, connectDB };

// // const { Client } = require("pg");
// // require("dotenv").config();

// // const db = new Client({
// //   connectionString: process.env.DATABASE_URL, // single env variable
// //   ssl: {
// //     rejectUnauthorized: false, // Render requires SSL
// //   },
// // });

// // const connectDB = async () => {
// //   try {
// //     await db.connect();
// //     console.log("PostgreSQL Connected (Client)");
// //   } catch (err) {
// //     console.error("DB Connection Error:", err.message);
// //     process.exit(1);
// //   }
// // };

// // module.exports = { db, connectDB };

const { Pool } = require("pg"); // 1. Change Client to Pool
require("dotenv").config();

const db = new Pool({
  host: process.env.PSQL_HOST,
  user: process.env.PSQL_USER,
  port: process.env.PSQL_PORT,
  password: process.env.PSQL_PASSWORD,
  database: process.env.PSQL_DATABASE,
  // Recommended additions:
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error if a connection takes too long
});

// With a Pool, you don't actually NEED a manual "connectDB" function 
// because the pool handles connecting automatically when you run a query.
const connectDB = async () => {
  try {
    const client = await db.connect();
    console.log("PostgreSQL Connected (Pool)");
    client.release(); // Crucial: Release it back to the pool!
  } catch (err) {
    console.error("DB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = { db, connectDB };