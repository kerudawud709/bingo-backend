const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const port = process.env.PORT || 10000;

// Database Connection
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

// Helper: Generate a valid 75-Ball Bingo Card
function generateBingoCard() {
  const getRandomNumbers = (min, max, count) => {
    const nums = new Set();
    while (nums.size < count) {
      nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(nums);
  };

  const b = getRandomNumbers(1, 15, 5);
  const i = getRandomNumbers(16, 30, 5);
  const n = getRandomNumbers(31, 45, 4);
  const g = getRandomNumbers(46, 60, 5);
  const o = getRandomNumbers(61, 75, 5);

  const card = [];
  for (let r = 0; r < 5; r++) {
    const row = [
      b[r],
      i[r],
      r === 2 ? 0 : (r > 2 ? n[r - 1] : n[r]),
      g[r],
      o[r]
    ];
    card.push(row);
  }
  return card;
}

// 75 Cartelas setup
const cartelas = {};
for (let id = 1; id <= 75; id++) {
  cartelas[id] = generateBingoCard();
}

// Game State & Timer
let takenCartelas = {}; 
let drawnNumbers = [];
let availableBalls = Array.from({ length: 75 }, (_, k) => k + 1);
let gameInterval = null;

function getLetterPrefix(num) {
  if (num <= 15) return "B " + num;
  if (num <= 30) return "I " + num;
  if (num <= 45) return "N " + num;
  if (num <= 60) return "G " + num;
  return "O " + num;
}

function startAutoCaller() {
  if (gameInterval) clearInterval(gameInterval);

  gameInterval = setInterval(() => {
    if (availableBalls.length === 0) {
      clearInterval(gameInterval);
      io.emit('game_finished');
      return;
    }

    // Pick random ball
    const randomIndex = Math.floor(Math.random() * availableBalls.length);
    const num = availableBalls.splice(randomIndex, 1)[0];
    drawnNumbers.push(num);

    const formattedDisplay = getLetterPrefix(num);

    // Broadcast number to all players in real time
    io.emit('number_drawn', {
      number: num,
      display: formattedDisplay
    });

    console.log(`🎱 Drawn: ${formattedDisplay}`);
  }, 4000); // Draws a new number every 4 seconds
}

// Socket Connections
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  const available = Object.keys(cartelas)
    .map(Number)
    .filter(id => !Object.values(takenCartelas).includes(id));
  
  socket.emit('cartela_list', { cartelas: available });

  socket.on('select_cartela', (number) => {
    if (Object.values(takenCartelas).includes(number)) {
      socket.emit('cartela_error', { message: 'Cartela already taken!' });
      return;
    }

    takenCartelas[socket.id] = number;
    socket.emit('cartela_selected', { number: number, card: cartelas[number] });

    const updatedAvailable = Object.keys(cartelas)
      .map(Number)
      .filter(id => !Object.values(takenCartelas).includes(id));
    
    io.emit('cartela_availability', { available: updatedAvailable });
  });

  // Admin Start Game Trigger
  socket.on('admin_start_game', () => {
    drawnNumbers = [];
    availableBalls = Array.from({ length: 75 }, (_, k) => k + 1);
    io.emit('game_started');
    startAutoCaller();
    socket.emit('admin_success', { message: 'Game & Auto-Caller Started!' });
  });

  socket.on('claim_bingo', () => {
    if (!takenCartelas[socket.id]) {
      socket.emit('false_alarm', { message: 'You have not selected a cartela!' });
      return;
    }
    
    if (gameInterval) clearInterval(gameInterval);
    io.emit('game_over', { winner: socket.id, fullCard: false });
  });

  socket.on('request_cartelas', () => {
    delete takenCartelas[socket.id];
    const avail = Object.keys(cartelas)
      .map(Number)
      .filter(id => !Object.values(takenCartelas).includes(id));
    socket.emit('cartela_list', { cartelas: avail });
  });

  socket.on('disconnect', () => {
    delete takenCartelas[socket.id];
    console.log('❌ User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.json({ status: "online", drawnCount: drawnNumbers.length });
});

server.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
