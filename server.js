const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static assets from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data structures
const userBalances = new Map(); // key: telegram_id, value: number
const activePlayers = new Map(); // key: socket.id, value: player object
let availableCartelas = Array.from({ length: 75 }, (_, i) => i + 1);
let drawnNumbers = [];
let drawInterval = null;
let currentSpeed = 4000;
let isPaused = false;
let prizePool = 0;

// Helper: Generate BINGO card numbers
function generateBingoCard() {
    const card = [];
    const ranges = [
        [1, 15],   // B
        [16, 30],  // I
        [31, 45],  // N
        [46, 60],  // G
        [61, 75]   // O
    ];

    const columns = ranges.map(([min, max]) => {
        const nums = new Set();
        while (nums.size < 5) {
            nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return Array.from(nums);
    });

    // Format into 5x5 grid (row by row) with center as 0 (Free Space)
    for (let r = 0; r < 5; r++) {
        const row = [];
        for (let c = 0; c < 5; c++) {
            if (r === 2 && c === 2) {
                row.push(0); // FREE SPACE
            } else {
                row.push(columns[c][r]);
            }
        }
        card.push(row);
    }
    return card;
}

// Socket Connections
io.on('connection', (socket) => {
    console.log(`[+] Client connected: ${socket.id}`);

    // Authenticate Telegram user
    socket.on('authenticate', (userData) => {
        const telegramId = userData?.id || 5486724656;
        const username = userData?.first_name || userData?.username || `User_${telegramId}`;

        // Default initial balance if new
        if (!userBalances.has(telegramId)) {
            userBalances.set(telegramId, 100.00); 
        }

        const balance = userBalances.get(telegramId);
        const isAdmin = String(telegramId) === "5486724656";

        socket.userData = { telegramId, username, isAdmin };

        socket.emit('account_data', {
            telegram_id: telegramId,
            username: username,
            balance: balance,
            isAdmin: isAdmin
        });

        // Send current available cartelas
        socket.emit('cartela_list', { cartelas: availableCartelas });
    });

    // Request Cartela List
    socket.on('request_cartelas', () => {
        socket.emit('cartela_list', { cartelas: availableCartelas });
    });

    // Select Cartela
    socket.on('select_cartela', (data) => {
        const { number, stake } = data;
        const stakeAmount = parseFloat(stake) || 10;

        if (!socket.userData) {
            return socket.emit('cartela_error', { message: 'Authentication required.' });
        }

        const currentBalance = userBalances.get(socket.userData.telegramId) || 0;

        if (stakeAmount < 5) {
            return socket.emit('cartela_error', { message: 'Minimum stake is 5 ETB.' });
        }

        if (currentBalance < stakeAmount) {
            return socket.emit('cartela_error', { message: 'Insufficient balance.' });
        }

        if (!availableCartelas.includes(number)) {
            return socket.emit('cartela_error', { message: 'Cartela already taken or invalid.' });
        }

        // Deduct balance and confirm cartela
        const newBalance = currentBalance - stakeAmount;
        userBalances.set(socket.userData.telegramId, newBalance);
        
        // Remove cartela from pool
        availableCartelas = availableCartelas.filter(c => c !== number);
        prizePool += stakeAmount * 0.85; // 85% goes to prize pool

        const cardMatrix = generateBingoCard();

        activePlayers.set(socket.id, {
            telegramId: socket.userData.telegramId,
            username: socket.userData.username,
            cartelaNumber: number,
            card: cardMatrix,
            stake: stakeAmount
        });

        socket.emit('balance_updated', { balance: newBalance });
        socket.emit('cartela_selected', { number: number, card: cardMatrix });
        io.emit('cartela_availability', { available: availableCartelas });
        io.emit('prize_pool_update', { prize: prizePool });
    });

    // Admin Controls
    socket.on('admin_start_game', () => {
        if (!socket.userData?.isAdmin) return;
        
        if (drawInterval) clearInterval(drawInterval);
        drawnNumbers = [];
        isPaused = false;

        io.emit('game_started');

        drawInterval = setInterval(() => {
            if (isPaused) return;

            if (drawnNumbers.length >= 75) {
                clearInterval(drawInterval);
                drawInterval = null;
                io.emit('game_finished');
                return;
            }

            let nextNum;
            do {
                nextNum = Math.floor(Math.random() * 75) + 1;
            } while (drawnNumbers.includes(nextNum));

            drawnNumbers.push(nextNum);
            io.emit('number_drawn', { number: nextNum });
        }, currentSpeed);

        socket.emit('admin_success', { message: '🚀 Game Started!' });
    });

    socket.on('admin_toggle_pause', () => {
        if (!socket.userData?.isAdmin) return;
        isPaused = !isPaused;
        io.emit('game_pause_status', { isPaused });
    });

    socket.on('admin_set_speed', (speedMs) => {
        if (!socket.userData?.isAdmin) return;
        currentSpeed = parseInt(speedMs) || 4000;
        if (drawInterval) {
            clearInterval(drawInterval);
            socket.emit('admin_start_game');
        }
    });

    socket.on('admin_add_balance', (data) => {
        if (!socket.userData?.isAdmin) return;
        const { targetTelegramId, amount } = data;
        const current = userBalances.get(Number(targetTelegramId)) || 0;
        const updated = current + parseFloat(amount);
        
        userBalances.set(Number(targetTelegramId), updated);

        // Notify target if online
        for (let [id, playerSocket] of io.sockets.sockets) {
            if (playerSocket.userData?.telegramId === Number(targetTelegramId)) {
                playerSocket.emit('balance_updated', { balance: updated });
            }
        }

        socket.emit('admin_success', { message: `Added ${amount} ETB to User ${targetTelegramId}` });
    });

    // Claim Bingo
    socket.on('claim_bingo', () => {
        const player = activePlayers.get(socket.id);
        if (!player) return;

        // Reset game state
        if (drawInterval) clearInterval(drawInterval);
        drawInterval = null;

        const currentBal = userBalances.get(player.telegramId) || 0;
        const newBal = currentBal + prizePool;
        userBalances.set(player.telegramId, newBal);

        io.emit('game_over', {
            winner: socket.id,
            winnerName: player.username,
            prize: prizePool
        });

        // Reset game variables for next round
        prizePool = 0;
        availableCartelas = Array.from({ length: 75 }, (_, i) => i + 1);
        activePlayers.clear();
        io.emit('prize_pool_update', { prize: 0 });
    });

    socket.on('disconnect', () => {
        console.log(`[-] Client disconnected: ${socket.id}`);
        activePlayers.delete(socket.id);
    });
});

// Safe Catch-all Route for Express (Render Compatible)
app.get('(.*)', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[+] Yeketema Bingo Server running on port ${PORT}`);
});
