cat << 'EOF' > index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yeketema Bingo</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #0f172a;
            color: white;
            text-align: center;
            margin: 0;
            padding: 16px;
        }
        .title {
            font-size: 1.4rem;
            font-weight: bold;
            margin-bottom: 18px;
        }
        .admin-button {
            background: #22c55e;
            color: white;
            border: none;
            padding: 12px;
            font-size: 1.05rem;
            border-radius: 9px;
            width: 100%;
            max-width: 360px;
            font-weight: bold;
            cursor: pointer;
            margin: 0 auto 15px auto;
            display: none;
        }
        #cartela-screen { display: block; }
        .selection-title { font-size: 1.1rem; margin-bottom: 15px; }
        .cartela-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            max-width: 360px;
            margin: 0 auto;
        }
        .cartela-button {
            background: #1e293b;
            color: white;
            border: 1px solid #334155;
            border-radius: 9px;
            padding: 14px 5px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
        }
        .cartela-button:active { background: #2563eb; }
        .cartela-button.unavailable {
            background: #334155;
            color: #64748b;
            text-decoration: line-through;
            cursor: not-allowed;
        }
        #game-screen { display: none; }
        .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            max-width: 340px;
            margin: 0 auto 15px auto;
        }
        .prize-badge {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #ffffff;
            padding: 8px 14px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.95rem;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
        }
        .card-number { font-size: 1rem; font-weight: bold; margin-bottom: 12px; }
        .drawn-container {
            background: #1e293b;
            padding: 12px;
            border-radius: 12px;
            margin-bottom: 16px;
        }
        #drawn-box {
            font-size: 2.8rem;
            color: #38bdf8;
            font-weight: bold;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            max-width: 340px;
            margin: 0 auto 20px auto;
        }
        .header-cell {
            background: #f97316;
            color: #0f172a;
            font-weight: bold;
            font-size: 1.2rem;
            padding: 10px 0;
            border-radius: 8px;
        }
        .cell {
            background: #1e293b;
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            font-weight: bold;
            font-size: 1.1rem;
            border: 1px solid #334155;
        }
        .cell.marked {
            background: #22c55e;
            border-color: #4ade80;
            color: #052e16;
        }
        .cell.star {
            background: #eab308;
            border-color: #fde047;
            color: #422006;
        }
        .claim-button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 14px;
            font-size: 1.1rem;
            border-radius: 10px;
            width: 100%;
            max-width: 340px;
            font-weight: bold;
            cursor: pointer;
        }
        .back-button {
            background: #475569;
            color: white;
            border: none;
            padding: 8px 14px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        }
    </style>
</head>
<body>

    <div class="title">🎲 Yeketema Bingo</div>

    <button id="admin-start-btn" class="admin-button" onclick="adminStartGame()">
        🚀 Start Game (Admin)
    </button>

    <div id="cartela-screen">
        <div class="selection-title">🎫 Choose Your Cartela</div>
        <div id="cartela-grid" class="cartela-grid"></div>
    </div>

    <div id="game-screen">
        <div class="top-bar">
            <button class="back-button" onclick="backToCartelas()">← Change</button>
            <div class="prize-badge">
                🏆 Win: $<span id="prize-amount">0.00</span>
            </div>
        </div>

        <div id="selected-card-number" class="card-number">Cartela --</div>

        <div class="drawn-container">
            <small style="color: #94a3b8;">CURRENT NUMBER</small>
            <div id="drawn-box">--</div>
        </div>

        <div class="grid" id="bingo-grid"></div>

        <button class="claim-button" onclick="claimBingo()">Claim Bingo! 🏆</button>
    </div>

    <script>
        const tg = window.Telegram?.WebApp;
        if (tg) tg.expand();

        const socket = io("https://bingo-backend-7rt0.onrender.com");

        socket.on("connect", () => {
            const userTelegramId = tg?.initDataUnsafe?.user?.id || 5486724656;
            socket.emit("authenticate", userTelegramId);
        });

        socket.on("account_data", (data) => {
            if (data.isAdmin || String(tg?.initDataUnsafe?.user?.id) === "5486724656") {
                document.getElementById("admin-start-btn").style.display = "block";
            }
        });

        socket.on("prize_pool_update", (data) => {
            document.getElementById("prize-amount").innerText = parseFloat(data.prize).toFixed(2);
        });

        function adminStartGame() {
            socket.emit("admin_start_game");
        }

        socket.on("admin_success", (data) => alert(data.message));
        socket.on("admin_error", (data) => alert(data.message));

        let myCard = [];
        let myCartelaNumber = null;

        socket.on("cartela_list", (data) => showCartelaList(data.cartelas));

        function showCartelaList(available) {
            const container = document.getElementById("cartela-grid");
            container.innerHTML = "";
            for (let i = 1; i <= 75; i++) {
                const button = document.createElement("button");
                button.innerText = i;
                button.className = "cartela-button";
                if (!available.includes(i)) {
                    button.classList.add("unavailable");
                    button.disabled = true;
                } else {
                    button.onclick = () => selectCartela(i);
                }
                container.appendChild(button);
            }
        }

        function selectCartela(number) {
            socket.emit("select_cartela", number);
        }

        socket.on("cartela_selected", (data) => {
            myCartelaNumber = data.number;
            myCard = data.card;
            document.getElementById("selected-card-number").innerText = "🎫 Cartela " + myCartelaNumber;
            document.getElementById("cartela-screen").style.display = "none";
            document.getElementById("game-screen").style.display = "block";
            renderGrid();
        });

        socket.on("cartela_availability", (data) => {
            if (document.getElementById("cartela-screen").style.display !== "none") {
                showCartelaList(data.available);
            }
        });

        socket.on("cartela_error", (data) => alert(data.message));

        function renderGrid() {
            const grid = document.getElementById("bingo-grid");
            grid.innerHTML = "";

            ['B', 'I', 'N', 'G', 'O'].forEach(letter => {
                const headerCell = document.createElement("div");
                headerCell.className = "header-cell";
                headerCell.innerText = letter;
                grid.appendChild(headerCell);
            });

            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    const number = myCard[row][col];
                    const cell = document.createElement("div");

                    if (number === 0) {
                        cell.className = "cell star marked";
                        cell.innerText = "★";
                    } else {
                        cell.className = "cell";
                        cell.innerText = number < 10 ? "0" + number : number;
                        cell.id = "cell-" + number;
                    }
                    grid.appendChild(cell);
                }
            }
        }

        socket.on("number_drawn", (data) => {
            const display = data.display || (data.number < 10 ? "0" + data.number : data.number);
            document.getElementById("drawn-box").innerText = display;
            markNumber(data.number);
        });

        function markNumber(number) {
            const cell = document.getElementById("cell-" + number);
            if (cell) cell.classList.add("marked");
        }

        socket.on("game_started", () => console.log("🎱 Game started!"));
        socket.on("game_finished", () => alert("🎱 All 75 numbers have been called."));

        socket.on("game_over", (data) => {
            if (data.winner === socket.id) {
                alert(data.fullCard ? "🏆 BINGO!\n\n🎁 FULL CARTELA BONUS!" : "🏆 BINGO!\n\nYou completed 2 lines!");
            } else {
                alert("🏆 GAME OVER!\n\nAnother player won.");
            }
        });

        socket.on("false_alarm", (data) => alert(data.message));

        function claimBingo() {
            socket.emit("claim_bingo");
        }

        function backToCartelas() {
            document.getElementById("game-screen").style.display = "none";
            document.getElementById("cartela-screen").style.display = "block";
            socket.emit("request_cartelas");
        }
    </script>
</body>
</html>
EOF
