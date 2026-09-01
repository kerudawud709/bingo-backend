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

// Set your Admin Telegram ID here (Replace with your actual Telegram User ID)
const ADMIN_TELEGRAM_ID = 5486724656; 

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
        balance NUMERIC(10, 2) DEFAULT 100.00,
        wins INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS game_history (
        id SERIAL PRIMARY KEY,
        winner_id BIGINT,
        prize_amount NUMERIC(10, 2),
        won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("🐘 Database initialized successfully!");
  } catch (err) {
    console.error("❌ Database error:", err);
  }
}

initDB();

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
    card.push([
      b[r],
      i[r],
      r === 2 ? 0 : (r > 2 ? n[r - 1] : n[r]),
      g[r],
      o[r]
    ]);
  }
  return card;
}

const cartelas = {};
for (let id = 1; id <= 75; id++) {
  cartelas[id] = generateBingoCard();
}

let takenCartelas = {}; 
let playerSockets = {}; 
let drawnNumbers = [];
let availableBalls = Array.from({ length: 75 }, (_, k) => k + 1);
let gameInterval = null;
const ENTRY_FEE = 10.00;

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

function verifyBingo(card) {
  let horizontalCount = 0;
  let verticalCount = 0;
  let diagonalCount = 0;

  for (let r = 0; r < 5; r++) {
    if (card[r].every(isMarked)) horizontalCount++;
  }

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

  if ([0, 1, 2, 3, 4].every(i => isMarked(card[i][i]))) diagonalCount++;
  if ([0, 1, 2, 3, 4].every(i => isMarked(card[i][4 - i]))) diagonalCount++;

  const cornersFilled = isMarked(card[0][0]) && isMarked(card[0][4]) && isMarked(card[4][0]) && isMarked(card[4][4]);
  const totalLines = horizontalCount + verticalCount + diagonalCount;

  let totalMarked = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (isMarked(card[r][c])) totalMarked++;
    }
  }

  const isFullCard = totalMarked === 25;
  const hasTwoLines = totalLines >= 2;
  const hasLineAndCorners = cornersFilled && (horizontalCount >= 1 || verticalCount >= 1 || diagonalCount >= 1);

  return { valid: hasTwoLines || hasLineAndCorners || isFullCard, fullCard: isFullCard };
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

    io.emit('number_drawn', {
      number: num,
      display: getLetterPrefix(num)
    });
  }, 4000);
}

io.on('connection', (socket) => {

  socket.on('authenticate', async (telegramId) => {
    try {
      let res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
      if (res.rows.length === 0) {
        res = await pool.query(
          'INSERT INTO users (telegram_id, balance) VALUES ($1, $2) RETURNING *',
          [telegramId, 100.00]
        );
      }
      playerSockets[telegramId] = socket.id;
      socket.telegramId = telegramId;
      
      const isAdmin = String(telegramId) === String(ADMIN_TELEGRAM_ID);
      socket.emit('account_data', { ...res.rows[0], isAdmin });
    } catch (err) {
      console.error("Auth error:", err);
    }
  });

  socket.on('get_leaderboard', async () => {
    try {
      const result = await pool.query(
        'SELECT telegram_id, username, wins, balance FROM users ORDER BY wins DESC LIMIT 10'
      );
      socket.emit('leaderboard_data', result.rows);
    } catch (err) {
      console.error("Leaderboard error:", err);
    }
  });

  const getAvailableCartelas = () => Object.keys(cartelas)
    .map(Number)
    .filter(id => !Object.values(takenCartelas).some(item => item.number === id));

  socket.emit('cartela_list', { cartelas: getAvailableCartelas() });

  socket.on('select_cartela', async (number) => {
    const isTaken = Object.values(takenCartelas).some(item => item.number === number);
    if (isTaken) {
      socket.emit('cartela_error', { message: 'Cartela already taken!' });
      return;
    }

    if (socket.telegramId) {
      try {
        const userRes = await pool.query('SELECT balance FROM users WHERE telegram_id = $1', [socket.telegramId]);
        const currentBalance = parseFloat(userRes.rows[0]?.balance || 0);

        if (currentBalance < ENTRY_FEE) {
          socket.emit('cartela_error', { message: 'Insufficient balance!' });
          return;
        }

        const updatedUser = await pool.query(
          'UPDATE users SET balance = balance - $1 WHERE telegram_id = $2 RETURNING balance',
          [ENTRY_FEE, socket.telegramId]
        );

        socket.emit('balance_updated', { balance: updatedUser.rows[0].balance });
      } catch (err) {
        console.error("Deduction error:", err);
      }
    }

    takenCartelas[socket.id] = { number, userId: socket.telegramId };
    socket.emit('cartela_selected', { number: number, card: cartelas[number] });
    io.emit('cartela_availability', { available: getAvailableCartelas() });
  });

  // Admin Security Check
  socket.on('admin_start_game', () => {
    if (String(socket.telegramId) !== String(ADMIN_TELEGRAM_ID)) {
      socket.emit('admin_error', { message: 'Unauthorized action!' });
      return;
    }

    drawnNumbers = [];
    availableBalls = Array.from({ length: 75 }, (_, k) => k + 1);
    io.emit('game_started');
    startAutoCaller();
    socket.emit('admin_success', { message: 'Game Started!' });
  });

  socket.on('claim_bingo', async () => {
    const playerSelection = takenCartelas[socket.id];
    if (!playerSelection) {
      socket.emit('false_alarm', { message: 'You have not selected a cartela!' });
      return;
    }

    const playerCard = cartelas[playerSelection.number];
    const result = verifyBingo(playerCard);

    if (result.valid) {
      if (gameInterval) clearInterval(gameInterval);

      const totalPlayers = Object.keys(takenCartelas).length;
      const prizePool = totalPlayers * ENTRY_FEE;

      if (socket.telegramId) {
        try {
          await pool.query('UPDATE users SET balance = balance + $1, wins = wins + 1 WHERE telegram_id = $2', [prizePool, socket.telegramId]);
          await pool.query('INSERT INTO game_history (winner_id, prize_amount) VALUES ($1, $2)', [socket.telegramId, prizePool]);
        } catch (err) {
          console.error("Prize payout error:", err);
        }
      }

      io.emit('game_over', { winner: socket.id, prize: prizePool, fullCard: result.fullCard });
    } else {
      socket.emit('false_alarm', { 
        message: 'False Bingo! Rules:\n- 2 complete lines\n- 1 line + 4 corners\n- Full cartela' 
      });
    }
  });

  socket.on('request_cartelas', () => {
    delete takenCartelas[socket.id];
    socket.emit('cartela_list', { cartelas: getAvailableCartelas() });
  });

  socket.on('disconnect', () => {
    delete takenCartelas[socket.id];
    if (socket.telegramId) delete playerSockets[socket.telegramId];
  });
});

app.get('/', (req, res) => {
  res.json({ status: "online", activePlayers: Object.keys(takenCartelas).length });
});

server.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});
