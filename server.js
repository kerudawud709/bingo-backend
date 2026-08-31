const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Setup PostgreSQL pool using Render's DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Create tables on start
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        username VARCHAR(100),
        balance NUMERIC(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("🐘 PostgreSQL connected successfully!");
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
}

initDB();

app.get('/', (req, res) => {
  res.send('Bingo backend is live!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

