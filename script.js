document.addEventListener('DOMContentLoaded', () => {
    // 取得 HTML 元素 (【重大修改】)
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const statusBar = document.getElementById('status-bar'); // 【新】 計分板容器
    // (舊的 score1El, score2El, player1ScoreBox, player2ScoreBox 已移除)
    
    const gameOverMessage = document.getElementById('game-over-message'); 
    const winnerText = document.getElementById('winnerText');
    const confirmLineButton = document.getElementById('confirm-line-button');
    const cancelLineButton = document.getElementById('cancel-line-button');
    const actionBar = document.getElementById('action-bar');
    const resetButton = document.getElementById('reset-button');
    const modalOverlay = document.getElementById('modal-overlay');
    const resetButtonModal = document.getElementById('reset-button-modal');
    
    // 【新】 控制項
    const drawLengthInput = document.getElementById('draw-length-input');
    const playerCountInput = document.getElementById('player-count-input'); // 【新】 玩家人數
    
    // 【新】 勝利動畫
    const confettiContainer = document.getElementById('confetti-container');

    // 【新】 偵測是否為手機
    const isMobile = window.innerWidth < 768;
    
    // 【修改】 遊戲設定 (根據是否為手機動態調整)
    const ROW_LENGTHS = [4, 5, 6, 7, 6, 5, 4]; // 菱形網格的定義 (相同)
    const DOT_SPACING_X = isMobile ? 60 : 100; // 手機版間距縮小
    const DOT_SPACING_Y = DOT_SPACING_X * Math.sqrt(3) / 2;
    const PADDING = isMobile ? 30 : 50; // 手機版邊距縮小
    const DOT_RADIUS = isMobile ? 5 : 6; // 手機版點半徑
    const LINE_WIDTH = isMobile ? 5 : 6; // 手機版線寬 (已加粗)
    const CLICK_TOLERANCE_DOT = isMobile ? 20 : 15; // 手機版點擊範圍加大
    const ANGLE_TOLERANCE = 1.5; // 角度容許誤差 (相同)

    // 【重大修改】 玩家顏色 (擴充至 4 人)
    const PLAYER_COLORS = {
        1: { line: '#3498db', fill: 'rgba(52, 152, 219, 0.3)' },
        2: { line: '#e74c3c', fill: 'rgba(231, 76, 60, 0.3)' },
        3: { line: '#2ecc71', fill: 'rgba(46, 204, 113, 0.3)' },
        4: { line: '#9b59b6', fill: 'rgba(155, 89, 182, 0.3)' },
        0: { line: '#95a5a6', fill: 'rgba(149, 165, 166, 0.2)' } // 0 代表無玩家
    };
    const DEFAULT_LINE_COLOR = '#e0e0e0';

    // 【重大修改】 遊戲狀態
    let currentPlayer = 1;
    let scores = {}; // 改為動態
    let dots = []; 
    let lines = {}; 
    let triangles = [];
    let totalTriangles = 0; 
    let selectedDot1 = null;
    let selectedDot2 = null;
    let totalPlayers = 2; // 【新】
    let isAIBotActive = false; // 【新】 AI 狀態

    // ----- 輔助函式: 取得標準的線段 ID (相同) -----
    function getLineId(dot1, dot2) {
        if (!dot1 || !dot2) return null;
        let d1 = dot1, d2 = dot2;
        if (dot1.r > dot2.r || (dot1.r === dot2.r && dot1.c > dot2.c)) {
            d1 = dot2;
            d2 = dot1;
        }
        return `${d1.r},${d1.c}_${d2.r},${d2.c}`;
    }


    // 【重大修改】 初始化遊戲
    function initGame() {
        // 1. 讀取設定
        let requestedPlayers = parseInt(playerCountInput.value, 10);
        if (isNaN(requestedPlayers) || requestedPlayers < 1 || requestedPlayers > 4) {
            requestedPlayers = 2; // 預設值
            playerCountInput.value = "2";
        }

        isAIBotActive = (requestedPlayers === 1);
        totalPlayers = (requestedPlayers === 1) ? 2 : requestedPlayers; // 1人玩 = 2個玩家 (P1 vs AI)

        // 2. 計算畫布大小 (相同)
        const gridWidth = (Math.max(...ROW_LENGTHS) - 1) * DOT_SPACING_X;
        const gridHeight = (ROW_LENGTHS.length - 1) * DOT_SPACING_Y;
        canvas.width = gridWidth + PADDING * 2;
        canvas.height = gridHeight + PADDING * 2;

        // 3. 重置所有狀態
        currentPlayer = 1;
        scores = {};
        dots = [];
        lines = {};
        triangles = [];
        totalTriangles = 0;
        selectedDot1 = null;
        selectedDot2 = null;
        actionBar.classList.remove('visible'); 
        modalOverlay.classList.add('hidden'); 
        drawLengthInput.disabled = false;
        playerCountInput.disabled = false;

        // 4. 【新】 動態產生計分板
        statusBar.innerHTML = '';
        for (let i = 1; i <= totalPlayers; i++) {
            scores[i] = 0; // 同時初始化分數
            
            const scoreBox = document.createElement('div');
            scoreBox.id = `player${i}-score`;
            scoreBox.classList.add('score-box', `player${i}`);
            
            let playerName = `玩家 ${i}`;
            if (isAIBotActive && i === 2) {
                playerName = "電腦";
            }
            
            scoreBox.innerHTML = `${playerName}: <span id="score${i}">0</span>`;
            
            if (i === 1) {
                scoreBox.classList.add('active'); // P1 永遠先開始
            }
            statusBar.appendChild(scoreBox);
        }

        // 5. 產生所有點的座標 (相同)
        dots = [];
        ROW_LENGTHS.forEach((len, r) => {
            dots[r] = [];
            const rowWidth = (len - 1) * DOT_SPACING_X;
            const offsetX = (canvas.width - rowWidth) / 2;
            for (let c = 0; c < len; c++) {
                dots[r][c] = {
                    x: c * DOT_SPACING_X + offsetX,
                    y: r * DOT_SPACING_Y + PADDING,
                    r: r, c: c
                };
            }
        });

        // 6. 產生所有 "相鄰" 線段 (相同)
        lines = {};
        for (let r = 0; r < ROW_LENGTHS.length; r++) {
            for (let c = 0; c < ROW_LENGTHS[r]; c++) {
                const d1 = dots[r][c];
                // 6a. 橫向線 (同 r)
                if (c < ROW_LENGTHS[r] - 1) {
                    const d2 = dots[r][c + 1];
                    const id = getLineId(d1, d2);
                    lines[id] = { p1: d1, p2: d2, drawn: false, player: 0, sharedBy: 0, id: id };
                }
                // 6b. 斜向線 (到 r+1)
                if (r < ROW_LENGTHS.length - 1) {
                    const len1 = ROW_LENGTHS[r];
                    const len2 = ROW_LENGTHS[r+1];
                    if (len2 > len1) { // 菱形上半部 (r < 3)
                        const d_dl = dots[r + 1][c];
                        const id_dl = getLineId(d1, d_dl);
                        lines[id_dl] = { p1: d1, p2: d_dl, drawn: false, player: 0, sharedBy: 0, id: id_dl };
                        const d_dr = dots[r + 1][c + 1];
                        const id_dr = getLineId(d1, d_dr);
                        lines[id_dr] = { p1: d1, p2: d_dr, drawn: false, player: 0, sharedBy: 0, id: id_dr };
                    } else { // 菱形下半部 (r >= 3)
                        if (c < len2) { 
                            const d_dl = dots[r + 1][c];
                            const id_dl = getLineId(d1, d_dl);
                            lines[id_dl] = { p1: d1, p2: d_dl, drawn: false, player: 0, sharedBy: 0, id: id_dl };
                        }
                        if (c > 0) { 
                            const d_dr = dots[r + 1][c - 1];
                            const id_dr = getLineId(d1, d_dr);
                            lines[id_dr] = { p1: d1, p2: d_dr, drawn: false, player: 0, sharedBy: 0, id: id_dr };
                        }
                    }
                }
            }
        }

        // 7. 產生所有三角形 (計分用) (相同)
        triangles = [];
        totalTriangles = 0;
        for (let r = 0; r < ROW_LENGTHS.length - 1; r++) {
            const len1 = ROW_LENGTHS[r];
            const len2 = ROW_LENGTHS[r+1];
            if (len2 > len1) { // 菱形上半部 (r < 3)
                for (let c = 0; c < len1; c++) {
                    const d1 = dots[r][c];
                    const d2 = dots[r+1][c];
                    const d3 = dots[r+1][c+1];
                    if (d1 && d2 && d3) {
                        triangles.push({
                            lineKeys: [getLineId(d1, d2), getLineId(d1, d3), getLineId(d2, d3)],
                            dots: [d1, d2, d3],
                            filled: false, player: 0
                        });
                        totalTriangles++;
                    }
                    if (c < len1 - 1) {
                        const d4 = dots[r][c+1];
                        if (d1 && d4 && d3) {
                            triangles.push({
                                lineKeys: [getLineId(d1, d4), getLineId(d1, d3), getLineId(d4, d3)],
                                dots: [d1, d4, d3],
                                filled: false, player: 0
                            });
                            totalTriangles++;
                        }
                    }
                }
            } else { // 菱形下半部 (r >= 3)
                for (let c = 0; c < len2; c++) {
                    const d1 = dots[r][c];
                    const d2 = dots[r][c+1];
                    const d3 = dots[r+1][c];
                    if (d1 && d2 && d3) {
                        triangles.push({
                            lineKeys: [getLineId(d1, d2), getLineId(d1, d3), getLineId(d2, d3)],
                            dots: [d1, d2, d3],
                            filled: false, player: 0
                        });
                        totalTriangles++;
                    }
                    if (c < len2 - 1) {
                        const d4 = dots[r+1][c+1];
                        if(d2 && d3 && d4) {
                            triangles.push({
                                lineKeys: [getLineId(d2, d3), getLineId(d2, d4), getLineId(d3, d4)],
                                dots: [d2, d3, d4],
                                filled: false, player: 0
                            });
                            totalTriangles++;
                        }
                    }
                }
            }
        }
        
        // 8. 清除舊的勝利動畫 (相同)
        if (confettiContainer) {
            confettiContainer.innerHTML = '';
        }

        // 9. 繪製 (不需 updateUI, 因為計分板已在 (4) 產生)
        drawCanvas();
    }

    // 繪製畫布 (drawCanvas 函式 ... 保持不變)
    function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. 繪製三角形 (相同)
        triangles.forEach(tri => {
            if (tri.filled) {
                ctx.beginPath();
                ctx.moveTo(tri.dots[0].x, tri.dots[0].y);
                ctx.lineTo(tri.dots[1].x, tri.dots[1].y);
                ctx.lineTo(tri.dots[2].x, tri.dots[2].y);
                ctx.closePath();
                // 【修改】 確保 PLAYER_COLORS[0] 存在
                ctx.fillStyle = PLAYER_COLORS[tri.player] ? PLAYER_COLORS[tri.player].fill : PLAYER_COLORS[0].fill;
                ctx.fill();
            }
        });
        
        // 2. 繪製線條 (相同)
        for (const id in lines) {
            const line = lines[id];
            
            if (line.drawn) {
                if (line.sharedBy !== 0 && line.sharedBy !== line.player && PLAYER_COLORS[line.player] && PLAYER_COLORS[line.sharedBy]) {
                    // --- 繪製共享線 (兩條並排) ---
                    const dx = line.p2.x - line.p1.x;
                    const dy = line.p2.y - line.p1.y;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const offsetX = -dy / len;
                    const offsetY = dx / len;
                    
                    const offset = LINE_WIDTH / 3; 
                    const halfWidth = LINE_WIDTH / 2;
                    
                    ctx.beginPath();
                    ctx.moveTo(line.p1.x + offsetX * offset, line.p1.y + offsetY * offset);
                    ctx.lineTo(line.p2.x + offsetX * offset, line.p2.y + offsetY * offset);
                    ctx.strokeStyle = PLAYER_COLORS[line.player].line;
                    ctx.lineWidth = halfWidth;
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(line.p1.x - offsetX * offset, line.p1.y - offsetY * offset);
                    ctx.lineTo(line.p2.x - offsetX * offset, line.p2.y - offsetY * offset);
                    ctx.strokeStyle = PLAYER_COLORS[line.sharedBy].line;
                    ctx.lineWidth = halfWidth;
                    ctx.stroke();

                } else {
                    // --- 繪製普通單人線 ---
                    ctx.beginPath();
                    ctx.moveTo(line.p1.x, line.p1.y);
                    ctx.lineTo(line.p2.x, line.p2.y);
                    ctx.strokeStyle = PLAYER_COLORS[line.player] ? PLAYER_COLORS[line.player].line : PLAYER_COLORS[0].line;
                    ctx.lineWidth = LINE_WIDTH;
                    ctx.stroke();
                }
            } else {
                // --- 繪製預設的灰色虛線 ---
                ctx.beginPath();
                ctx.moveTo(line.p1.x, line.p1.y);
                ctx.lineTo(line.p2.x, line.p2.y);
                ctx.strokeStyle = DEFAULT_LINE_COLOR;
                ctx.lineWidth = 2;
                ctx.setLineDash([2, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // 3. 繪製點 (相同)
        dots.forEach(row => {
            row.forEach(dot => {
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, 2 * Math.PI); 
                ctx.fillStyle = '#34495e';
                ctx.fill();
            });
        });

        // 4. 繪製選取的點 和 預覽虛線 (相同)
        if (selectedDot1) {
            ctx.beginPath();
            ctx.arc(selectedDot1.x, selectedDot1.y, DOT_RADIUS + 3, 0, 2 * Math.PI);
            ctx.strokeStyle = PLAYER_COLORS[currentPlayer].line;
            ctx.lineWidth = 4; 
            ctx.stroke();
        }
        if (selectedDot2) {
            ctx.beginPath();
            ctx.arc(selectedDot2.x, selectedDot2.y, DOT_RADIUS + 3, 0, 2 * Math.PI);
            ctx.strokeStyle = PLAYER_COLORS[currentPlayer].line;
            ctx.lineWidth = 4; 
            ctx.stroke();
        }
        
        if (selectedDot1 && selectedDot2) {
            ctx.beginPath();
            ctx.moveTo(selectedDot1.x, selectedDot1.y);
            ctx.lineTo(selectedDot2.x, selectedDot2.y);
            ctx.strokeStyle = PLAYER_COLORS[currentPlayer].line;
            ctx.lineWidth = 4; 
            ctx.setLineDash([8, 4]); 
            ctx.stroke();
            ctx.setLineDash([]); 
        }
    }

    // 點擊/觸控畫布 (【修改】 AI 回合鎖定)
    function handleCanvasClick(e) {
        // 【修改】 AI 僅在 P2 且啟用時鎖定
        if (isAIBotActive && currentPlayer === 2) {
            return;
        }
        if (actionBar.classList.contains('visible')) {
            return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const mouseX = (clientX - rect.left) * scaleX;
        const mouseY = (clientY - rect.top) * scaleY;
        const clickedDot = findNearestDot(mouseX, mouseY);
        
        if (!clickedDot) {
            if (selectedDot1) cancelLine();
            return;
        }
        if (selectedDot1 === null) {
            selectedDot1 = clickedDot;
        } else if (selectedDot2 === null) {
            if (clickedDot === selectedDot1) {
                selectedDot1 = null;
            } else {
                selectedDot2 = clickedDot;
                actionBar.classList.add('visible');
            }
        }
        drawCanvas();
    }

    // "確認連線" 按鈕的函式
    function confirmLine() {
        if (!selectedDot1 || !selectedDot2) return;
        const dotA = selectedDot1;
        const dotB = selectedDot2;
        
        // 1. 角度檢查 (相同)
        const dy = dotB.y - dotA.y;
        const dx = dotB.x - dotA.x;
        if (dx !== 0 || dy !== 0) {
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const absAngle = Math.abs(angle);
            const isValidAngle = isClose(absAngle, 0) || 
                                 isClose(absAngle, 60) || 
                                 isClose(absAngle, 120) || 
                                 isClose(absAngle, 180);
            if (!isValidAngle) {
                alert("無效的線條 (必須是 0, 60, 120 或 180 度)");
                cancelLine();
                return;
            }
        }

        // 2. 拆解長線為短線 (相同)
        const allDotsOnLine = findIntermediateDots(dotA, dotB);
        const segmentIds = [];
        for (let i = 0; i < allDotsOnLine.length - 1; i++) {
            segmentIds.push(getLineId(allDotsOnLine[i], allDotsOnLine[i+1]));
        }
        if (segmentIds.length === 0) {
            alert("無效的線段 (找不到對應的格線)");
            cancelLine();
            return;
        }

        // 3. 檢查繪製長度限制 (動態讀取) (相同)
        const maxDrawLength = parseInt(drawLengthInput.value, 10);
        if (isNaN(maxDrawLength) || maxDrawLength < 1) {
            alert("請在 '限制長度' 欄位輸入一個大於 0 的數字。");
            cancelLine();
            return;
        }
        if (segmentIds.length > maxDrawLength) {
            alert(`無效的連線！\n你一次最多只能畫 ${maxDrawLength} 條線段。`);
            cancelLine();
            return;
        }

        // 4. 檢查線段是否存在 (相同)
        let allSegmentsExist = true;
        let newSegmentDrawn = false; 
        for (const id of segmentIds) {
            if (!lines[id]) {
                allSegmentsExist = false;
                break;
            }
        }
        if (!allSegmentsExist) {
            alert("無效的線段 (此連線未對齊網格)");
            cancelLine();
            return;
        }

        // 5. 遍歷所有線段，畫新線 "或" 標記共享線 (相同)
        for (const id of segmentIds) {
            if (lines[id]) {
                if (!lines[id].drawn) { 
                    lines[id].drawn = true;
                    lines[id].player = currentPlayer;
                    newSegmentDrawn = true;
                } else if (lines[id].player !== 0 && lines[id].player !== currentPlayer) {
                    lines[id].sharedBy = currentPlayer;
                }
            }
        }

        // 6. 檢查是否畫了新線 (相同)
        if (!newSegmentDrawn) {
            alert("這條線 (或所有部分) 已經被畫過了。");
            cancelLine();
            return;
        }

        // 7. 檢查得分 (【修改】 動態 scoreBox)
        let scoredThisTurn = false; 
        triangles.forEach(tri => {
            if (!tri.filled) {
                const isComplete = tri.lineKeys.every(key => lines[key] && lines[key].drawn);
                if (isComplete) {
                    tri.filled = true;
                    tri.player = currentPlayer;
                    scores[currentPlayer]++;
                    scoredThisTurn = true;
                    
                    // 【修改】 動態取得 scoreBox
                    const scoreBox = document.getElementById(`player${currentPlayer}-score`);
                    if (scoreBox) {
                        scoreBox.classList.add('score-pulse');
                        setTimeout(() => {
                            scoreBox.classList.remove('score-pulse');
                        }, 400); 
                    }
                }
            }
        });

        // 8. 重置選取 (相同)
        selectedDot1 = null;
        selectedDot2 = null;
        actionBar.classList.remove('visible'); 
        
        // 9. 繪製並更新 UI (【修改】 只需呼叫 updateUI)
        drawCanvas();
        updateUI(); 

        // 10. 檢查遊戲是否結束 (使用所有線條) (相同)
        let totalLines = Object.keys(lines).length;
        let drawnLines = 0;
        for (const id in lines) {
            if (lines[id].drawn) {
                drawnLines++;
            }
        }
        if (drawnLines === totalLines) {
            endGame(); 
            return;
        }

        // 11. 換人 (相同)
        switchPlayer();
    }

    // "取消選取" 按鈕的函式 (相同)
    function cancelLine() {
        selectedDot1 = null;
        selectedDot2 = null;
        actionBar.classList.remove('visible');
        drawCanvas();
    }


    // ----- 輔助函式 -----

    // (相同)
    function isClose(val, target) {
        return Math.abs(val - target) < ANGLE_TOLERANCE;
    }

    // 輔助函式 - 找到最近的點 (相同)
    function findNearestDot(mouseX, mouseY) {
        let nearestDot = null;
        let minDisSq = CLICK_TOLERANCE_DOT ** 2; 
        dots.forEach(row => {
            row.forEach(dot => {
                const distSq = (mouseX - dot.x) ** 2 + (mouseY - dot.y) ** 2;
                if (distSq < minDisSq) {
                    minDisSq = distSq;
                    nearestDot = dot;
                }
            });
        });
        return nearestDot;
    }

    // (相同)
    function findIntermediateDots(dotA, dotB) {
        const intermediateDots = [];
        const minX = Math.min(dotA.x, dotB.x) - 1;
        const maxX = Math.max(dotA.x, dotB.x) + 1;
        const minY = Math.min(dotA.y, dotB.y) - 1;
        const maxY = Math.max(dotA.y, dotB.y) + 1;
        const EPSILON = 1e-6; 

        dots.flat().forEach(dot => {
            if (dot.x >= minX && dot.x <= maxX && dot.y >= minY && dot.y <= maxY) {
                const crossProduct = (dotB.y - dotA.y) * (dot.x - dotB.x) - (dot.y - dotB.y) * (dotB.x - dotA.x);
                if (Math.abs(crossProduct) < EPSILON) {
                    intermediateDots.push(dot);
                }
            }
        });

        intermediateDots.sort((a, b) => {
            if (Math.abs(a.x - b.x) > EPSILON) return a.x - b.x;
            return a.y - b.y;
        });

        return intermediateDots;
    }

    // 【重大修改】 切換玩家 (N 位玩家)
    function switchPlayer() {
        // 輪替到下一位
        currentPlayer++;
        if (currentPlayer > totalPlayers) {
            currentPlayer = 1;
        }
        
        updateUI();

        // 檢查是否輪到 AI
        if (isAIBotActive && currentPlayer === 2) {
            drawLengthInput.disabled = true;
            playerCountInput.disabled = true;
            setTimeout(makeAIMove, 750);
        } else {
            // 輪到人類玩家
            drawLengthInput.disabled = false;
            playerCountInput.disabled = true; // 遊戲開始後不允許修改玩家人數
        }
    }

    // 【重大修改】 更新分數和玩家狀態 (N 位玩家)
    function updateUI() {
        // 1. 更新分數
        for (let i = 1; i <= totalPlayers; i++) {
            const scoreEl = document.getElementById(`score${i}`);
            if (scoreEl) {
                scoreEl.textContent = scores[i];
            }
        }
        
        // 2. 更新作用中的計分板
        for (let i = 1; i <= totalPlayers; i++) {
            const scoreBox = document.getElementById(`player${i}-score`);
            if (scoreBox) {
                if (i === currentPlayer) {
                    scoreBox.classList.add('active');
                } else {
                    scoreBox.classList.remove('active');
                }
            }
        }
        
        // (不需要更新 AI 名稱，因為在 initGame 已設定)
    }

    // 【重大修改】 遊戲結束 (N 位玩家)
    function endGame() {
        // 1. 找出最高分
        let maxScore = -1;
        let winners = [];
        for (let i = 1; i <= totalPlayers; i++) {
            if (scores[i] > maxScore) {
                maxScore = scores[i];
                winners = [i]; // 新的最高分
            } else if (scores[i] === maxScore) {
                winners.push(i); // 平手
            }
        }

        // 2. 產生勝利訊息
        let winnerMessage = "";
        if (winners.length > 1) {
            // 平手
            const winnerNames = winners.map(w => {
                return (isAIBotActive && w === 2) ? "電腦" : `玩家 ${w}`;
            });
            winnerMessage = `平手！ (${winnerNames.join(', ')})`;
        } else {
            // 單一贏家
            const winnerName = (isAIBotActive && winners[0] === 2) ? "電腦" : `玩家 ${winners[0]}`;
            winnerMessage = `${winnerName} 獲勝！`;
        }
        winnerText.textContent = winnerMessage;
        
        // 3. 觸發動畫
        createConfetti(); 

        // 4. 禁用控制項
        drawLengthInput.disabled = true;
        playerCountInput.disabled = true;

        // 5. 顯示彈窗
        modalOverlay.classList.remove('hidden'); 
        actionBar.classList.remove('visible'); 
    }


    // ----- 【新】 AI 相關功能 -----
    // (AI 相關功能幾乎不變，因為 AI 永遠是 P2)

    // AI 執行移動
    function makeAIMove() {
        if (currentPlayer !== 2 || !isAIBotActive) return;

        const bestLineId = findBestMove();

        if (bestLineId) {
            const line = lines[bestLineId];
            let newSegmentDrawn = false;
            
            if (line && !line.drawn) { 
                line.drawn = true;
                line.player = currentPlayer; // currentPlayer 肯定是 2
                newSegmentDrawn = true;
            } else if (line && line.player !== 0 && line.player !== currentPlayer) {
                line.sharedBy = currentPlayer;
            }

            if (!newSegmentDrawn) {
                switchPlayer();
                return;
            }

            // 檢查得分
            let scoredThisTurn = false;
            triangles.forEach(tri => {
                if (!tri.filled) {
                    const isComplete = tri.lineKeys.every(key => lines[key] && lines[key].drawn);
                    if (isComplete) {
                        tri.filled = true;
                        tri.player = currentPlayer;
                        scores[currentPlayer]++;
                        scoredThisTurn = true;
                        
                        // 【修改】 動態取得 AI (P2) 的 scoreBox
                        const scoreBox = document.getElementById(`player2-score`);
                        if(scoreBox) {
                            scoreBox.classList.add('score-pulse');
                            setTimeout(() => {
                                scoreBox.classList.remove('score-pulse');
                            }, 400); 
                        }
                    }
                }
            });
            
            drawCanvas();
            updateUI(); 

            // 檢查遊戲結束 (相同)
            let totalLines = Object.keys(lines).length;
            let drawnLines = 0;
            for (const id in lines) {
                if (lines[id].drawn) {
                    drawnLines++;
                }
            }
            if (drawnLines === totalLines) {
                endGame();
                return;
            }

            // 換人 (相同)
            switchPlayer();

        } else {
            switchPlayer();
        }
    }

    // AI "大腦": 尋找最佳移動 (相同)
    function findBestMove() {
        const scoringMove = findScoringMove();
        if (scoringMove) {
            return scoringMove;
        }
        const safeMoves = findSafeMoves();
        if (safeMoves.length > 0) {
            return safeMoves[Math.floor(Math.random() * safeMoves.length)];
        }
        const allAvailableMoves = Object.values(lines).filter(l => !l.drawn).map(l => l.id);
        if (allAvailableMoves.length > 0) {
            return allAvailableMoves[Math.floor(Math.random() * allAvailableMoves.length)];
        }
        return null;
    }

    // 策略 1: (相同)
    function findScoringMove() {
        for (const tri of triangles) {
            if (tri.filled) continue;
            let undrawnLineKey = null;
            let drawnCount = 0;
            for (const key of tri.lineKeys) {
                if (lines[key] && lines[key].drawn) {
                    drawnCount++;
                } else if (lines[key]) {
                    undrawnLineKey = key;
                }
            }
            if (drawnCount === 2 && undrawnLineKey) {
                return undrawnLineKey; 
            }
        }
        return null;
    }

    // 策略 2: (相同)
    function findSafeMoves() {
        const availableLineIds = Object.values(lines).filter(l => !l.drawn).map(l => l.id);
        const safeMoveIds = [];
        for (const lineId of availableLineIds) {
            let isSafe = true;
            for (const tri of triangles) {
                if (tri.filled || !tri.lineKeys.includes(lineId)) {
                    continue;
                }
                let hypotheticalDrawnCount = 0;
                for (const key of tri.lineKeys) {
                    if ((lines[key] && lines[key].drawn) || key === lineId) {
                        hypotheticalDrawnCount++;
                    }
                }
                if (hypotheticalDrawnCount === 2) {
                    isSafe = false;
                    break;
                }
            }
            if (isSafe) {
                safeMoveIds.push(lineId);
            }
        }
        return safeMoveIds;
    }


    // ----- 勝利動畫 (相同) -----
    function createConfetti() {
        if (!confettiContainer) return;
        confettiContainer.innerHTML = '';
        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6']; 
        const confettiCount = 100; 

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            const delay = Math.random() * 3;
            const duration = Math.random() * 3 + 4;
            const rotateSpeed = Math.random() * 2 + 2;
            confetti.style.animationDelay = `${delay}s, ${delay}s`;
            confetti.style.animationDuration = `${duration}s, ${rotateSpeed}s`;
            confetti.style.transform = `rotateZ(${Math.random() * 360}deg)`;
            confettiContainer.appendChild(confetti);
        }
    }


    // ----------------------------
    
    // 【重大修改】 綁定所有事件
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handleCanvasClick(e);
    });

    resetButton.addEventListener('click', initGame);
    resetButtonModal.addEventListener('click', initGame);
    confirmLineButton.addEventListener('click', confirmLine);
    cancelLineButton.addEventListener('click', cancelLine);
    
    // 【新】 當玩家人數或長度改變時，重置遊戲
    playerCountInput.addEventListener('change', initGame);
    drawLengthInput.addEventListener('change', initGame);


    // 啟動遊戲
    initGame();
});