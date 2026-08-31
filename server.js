


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

// Helper: Generate a valid 75-Ball Bingo Card (5x5 grid with FREE space at center)
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
  const n = getRandomNumbers(31, 45, 4); // 4 numbers, center is FREE (0)
  const g = getRandomNumbers(46, 60, 5);
  const o = getRandomNumbers(61, 75, 5);

  const card = [];
  for (let r = 0; r < 5; r++) {
    const row = [
      b[r],
      i[r],
      r === 2 ? 0 : (r > 2 ? n[r - 1] : n[r]), // Center free space (0)
      g[r],
      o[r]
    ];
    card.push(row);
  }
  return card;
}

// Store 75 pre-generated cartelas
const cartelas = {};
for (let id = 1; id <= 75; id++) {
  cartelas[id] = generateBingoCard();
}

console.log("🎫 75 cartelas created.");

// Game State
let takenCartelas = {}; // socketId -> cartelaNumber
let drawnNumbers = [];
let gameRunning = false;

// Socket Connections
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  // Send available cartela numbers
  const available = Object.keys(cartelas)
    .map(Number)
    .filter(id => !Object.values(takenCartelas).includes(id));
  
  socket.emit('cartela_list', { cartelas: available });

  // Player selects a cartela
  socket.on('select_cartela', (number) => {
    if (Object.values(takenCartelas).includes(number)) {
      socket.emit('cartela_error', { message: 'Cartela already taken!' });
      return;
    }

    takenCartelas[socket.id] = number;
    const playerCard = cartelas[number];

    socket.emit('cartela_selected', { number: number, card: playerCard });

    // Broadcast updated available list to everyone
    const updatedAvailable = Object.keys(cartelas)
      .map(Number)
      .filter(id => !Object.values(takenCartelas).includes(id));
    
    io.emit('cartela_availability', { available: updatedAvailable });
  });

  // Admin Start Game
  socket.on('admin_start_game', () => {
    gameRunning = true;
    drawnNumbers = [];
    io.emit('game_started');
    socket.emit('admin_success', { message: 'Game Started!' });
  });

  // Handle Player Claiming Bingo
  socket.on('claim_bingo', () => {
    const playerCartelaNum = takenCartelas[socket.id];
    if (!playerCartelaNum) {
      socket.emit('false_alarm', { message: 'You have not selected a cartela!' });
      return;
    }

    // Broadcast win
    io.emit('game_over', { winner: socket.id, fullCard: false });
  });

  // Player request cartelas view again
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
  res.json({ status: "online", game: gameRunning ? "active" : "waiting" });
});

server.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
