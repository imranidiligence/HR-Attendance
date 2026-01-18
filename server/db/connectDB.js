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

const { Client } = require("pg");
require("dotenv").config();

const db = new Client({
  connectionString: process.env.DATABASE_URL, // single env variable
  ssl: {
    rejectUnauthorized: false, // Render requires SSL
  },
});

const connectDB = async () => {
  try {
    await db.connect();
    console.log("PostgreSQL Connected (Client)");
  } catch (err) {
    console.error("DB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = { db, connectDB };

