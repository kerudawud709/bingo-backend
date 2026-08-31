const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3000;

// Setup Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

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

// HTTP Fallback Route
app.get('/', (req, res) => {
  res.json({ status: "online", message: "Yeketema Bingo WebSocket server is running" });
});

// Socket.IO Real-time Connections
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  // Send sample available cartelas (1 to 75)
  socket.emit('cartela_list', {
    cartelas: Array.from({ length: 75 }, (_, i) => i + 1)
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
