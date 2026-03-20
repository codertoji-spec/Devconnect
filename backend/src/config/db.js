const { Pool } = require("pg");

// Pool = a collection of reusable DB connections
// Instead of opening/closing a connection every request, we reuse them
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection when server starts
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Database connected successfully");
    release(); // Release the client back to the pool
  }
});

module.exports = pool;
