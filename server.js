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

// Generate a valid 75-Ball Bingo Card
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

const cartelas = {};
for (let id = 1; id <= 75; id++) {
  cartelas[id] = generateBingoCard();
}

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

function isMarked(num) {
  return num === 0 || drawnNumbers.includes(num);
}

// Custom Bingo Rule Verification
function verifyBingo(card) {
  let horizontalCount = 0;
  let verticalCount = 0;
  let diagonalCount = 0;

  // 1. Check Horizontal Rows
  for (let r = 0; r < 5; r++) {
    if (card[r].every(isMarked)) horizontalCount++;
  }

  // 2. Check Vertical Columns
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    for (let r = 0; r < 5; r++) {
      if (!isMarked(card[r][c])) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) verticalCount++;
  }

  // 3. Check Diagonals
  const diag1 = [0, 1, 2, 3, 4].every(i => isMarked(card[i][i]));
  const diag2 = [0, 1, 2, 3, 4].every(i => isMarked(card[i][4 - i]));
  if (diag1) diagonalCount++;
  if (diag2) diagonalCount++;

  // 4. Check Four Corners
  const cornersFilled = isMarked(card[0][0]) && 
                        isMarked(card[0][4]) && 
                        isMarked(card[4][0]) && 
                        isMarked(card[4][4]);

  // Total lines (Horizontal + Vertical + Diagonal)
  const totalLines = horizontalCount + verticalCount + diagonalCount;

  // 5. Check Full Cartela (Blackout)
  let totalMarked = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (isMarked(card[r][c])) totalMarked++;
    }
  }
  const isFullCard = totalMarked === 25;

  // WIN CONDITIONS:
  // - 2 Lines (any combination: 2 Horizontal, 2 Vertical, 1 Horiz + 1 Vert, 1 Line + 1 Diag)
  // - 1 Horizontal Line + 4 Corners
  // - 1 Vertical Line + 4 Corners
  // - 1 Diagonal Line + 4 Corners
  // - Full Cartela
  const hasTwoLines = totalLines >= 2;
  const hasLineAndCorners = cornersFilled && (horizontalCount >= 1 || verticalCount >= 1 || diagonalCount >= 1);

  const isValidWin = hasTwoLines || hasLineAndCorners || isFullCard;

  return { valid: isValidWin, fullCard: isFullCard };
}

function startAutoCaller() {
  if (gameInterval) clearInterval(gameInterval);

  gameInterval = setInterval(() => {
    if (availableBalls.length === 0) {
      clearInterval(gameInterval);
      io.emit('game_finished');
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableBalls.length);
    const num = availableBalls.splice(randomIndex, 1)[0];
    drawnNumbers.push(num);

    const formattedDisplay = getLetterPrefix(num);

    io.emit('number_drawn', {
      number: num,
      display: formattedDisplay
    });

    console.log(`🎱 Drawn: ${formattedDisplay}`);
  }, 4000);
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

  socket.on('admin_start_game', () => {
    drawnNumbers = [];
    availableBalls = Array.from({ length: 75 }, (_, k) => k + 1);
    io.emit('game_started');
    startAutoCaller();
    socket.emit('admin_success', { message: 'Game Started!' });
  });

  socket.on('claim_bingo', () => {
    const playerCartelaNum = takenCartelas[socket.id];
    if (!playerCartelaNum) {
      socket.emit('false_alarm', { message: 'You have not selected a cartela!' });
      return;
    }

    const playerCard = cartelas[playerCartelaNum];
    const result = verifyBingo(playerCard);

    if (result.valid) {
      if (gameInterval) clearInterval(gameInterval);
      io.emit('game_over', { winner: socket.id, fullCard: result.fullCard });
      console.log(`🏆 Valid Bingo by ${socket.id}!`);
    } else {
      socket.emit('false_alarm', { 
        message: 'False Bingo! Valid win combinations:\n- Any 2 complete lines\n- Any 1 line + 4 corners\n- Full cartela' 
      });
      console.log(`⚠️ False Bingo attempt by ${socket.id}`);
    }
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
