// 初始化游戏状态
let currentPlayer = 'black'; // 当前玩家,'black'或'white'
let gameBoard = Array(4).fill().map(() => Array(9).fill(null)); // 4个区块,每个区块9个格子
let needRotation = false; // 是否需要选择旋转
let selectedBlock = null; // 当前选中的区块
let gameOver = false; // 游戏是否结束

// 在线对战变量（只声明一次）
let socket;
let playerColor;
let currentRoom;
let myTurn = false;
let needRotate = false;

// 添加状态更新函数
function updateStatus() {
    const statusElement = document.getElementById('current-player');
    if (!playerColor) {
        statusElement.textContent = '等待连接...';
    } else if (!myTurn) {
        statusElement.textContent = '等待对手...';
    } else if (needRotation) {
        statusElement.textContent = `请选择一个区块旋转 (${playerColor === 'black' ? '黑子' : '白子'})`;
    } else {
        statusElement.textContent = `轮到你下棋了 (${playerColor === 'black' ? '黑子' : '白子'})`;
    }
}

// 检查是否获胜
function checkWin() {
    // 将四个区块合并成一个6x6的棋盘
    let fullBoard = Array(6).fill().map(() => Array(6).fill(null));
    
    // 填充棋盘
    // 左上区块(block 0)
    for(let i = 0; i < 3; i++) {
        for(let j = 0; j < 3; j++) {
            fullBoard[i][j] = gameBoard[0][i*3 + j];
        }
    }
    // 右上区块(block 1)
    for(let i = 0; i < 3; i++) {
        for(let j = 0; j < 3; j++) {
            fullBoard[i][j+3] = gameBoard[1][i*3 + j];
        }
    }
    // 左下区块(block 2)
    for(let i = 0; i < 3; i++) {
        for(let j = 0; j < 3; j++) {
            fullBoard[i+3][j] = gameBoard[2][i*3 + j];
        }
    }
    // 右下区块(block 3)
    for(let i = 0; i < 3; i++) {
        for(let j = 0; j < 3; j++) {
            fullBoard[i+3][j+3] = gameBoard[3][i*3 + j];
        }
    }

    // 检查行
    for(let i = 0; i < 6; i++) {
        for(let j = 0; j <= 1; j++) {
            if(fullBoard[i][j] &&
               fullBoard[i][j] === fullBoard[i][j+1] &&
               fullBoard[i][j] === fullBoard[i][j+2] &&
               fullBoard[i][j] === fullBoard[i][j+3] &&
               fullBoard[i][j] === fullBoard[i][j+4]) {
                return fullBoard[i][j];
            }
        }
    }

    // 检查列
    for(let j = 0; j < 6; j++) {
        for(let i = 0; i <= 1; i++) {
            if(fullBoard[i][j] &&
               fullBoard[i][j] === fullBoard[i+1][j] &&
               fullBoard[i][j] === fullBoard[i+2][j] &&
               fullBoard[i][j] === fullBoard[i+3][j] &&
               fullBoard[i][j] === fullBoard[i+4][j]) {
                return fullBoard[i][j];
            }
        }
    }

    // 检查对角线
    for(let i = 0; i <= 1; i++) {
        for(let j = 0; j <= 1; j++) {
            // 检查右下对角线
            if(fullBoard[i][j] &&
               fullBoard[i][j] === fullBoard[i+1][j+1] &&
               fullBoard[i][j] === fullBoard[i+2][j+2] &&
               fullBoard[i][j] === fullBoard[i+3][j+3] &&
               fullBoard[i][j] === fullBoard[i+4][j+4]) {
                return fullBoard[i][j];
            }
            // 检查左下对角线
            if(fullBoard[i][j+4] &&
               fullBoard[i][j+4] === fullBoard[i+1][j+3] &&
               fullBoard[i][j+4] === fullBoard[i+2][j+2] &&
               fullBoard[i][j+4] === fullBoard[i+3][j+1] &&
               fullBoard[i][j+4] === fullBoard[i+4][j]) {
                return fullBoard[i][j+4];
            }
        }
    }
    
    return null;
}

// 创建棋盘格子
function createBoard() {
    for (let blockId = 1; blockId <= 4; blockId++) {
        const block = document.getElementById(`block${blockId}`);
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.block = blockId - 1;
            cell.dataset.cell = i;
            cell.addEventListener('click', handleCellClick);
            block.appendChild(cell);
        }
        // 为每个区块添加点击事件
        block.addEventListener('click', handleBlockClick);
    }
    
    // 创建旋转控制界面
    const rotationControls = document.querySelector('.rotation-controls');
    const clockwiseBtn = document.createElement('button');
    clockwiseBtn.textContent = '顺时针旋转';
    clockwiseBtn.className = 'rotate-btn';
    clockwiseBtn.style.display = 'none';
    clockwiseBtn.onclick = () => rotate('clockwise');
    
    const counterClockwiseBtn = document.createElement('button');
    counterClockwiseBtn.textContent = '逆时针旋转';
    counterClockwiseBtn.className = 'rotate-btn';
    counterClockwiseBtn.style.display = 'none';
    counterClockwiseBtn.onclick = () => rotate('counterclockwise');
    
    rotationControls.appendChild(clockwiseBtn);
    rotationControls.appendChild(counterClockwiseBtn);
}

// 修改 handleCellClick 函数
function handleCellClick(event) {
    if (!myTurn || needRotation || gameOver) {
        return;
    }
    
    const block = parseInt(event.target.dataset.block);
    const cell = parseInt(event.target.dataset.cell);
    
    if (gameBoard[block][cell]) return;
    
    // 发送移动信息给服务器
    socket.emit('makeMove', { 
        blockId: block, 
        cellIndex: cell 
    });
    
    // 更新本地游戏状态
    gameBoard[block][cell] = playerColor;
    const piece = document.createElement('div');
    piece.className = playerColor;
    event.target.appendChild(piece);
    
    // 下棋后需要旋转
    needRotation = true;
    updateStatus();
}

// 修改处理区块点击事件
function handleBlockClick(event) {
    if (!needRotation || gameOver || !myTurn) return;
    
    // 获取被点击的区块ID
    let blockId;
    if (event.target.className === 'cell') {
        blockId = parseInt(event.target.parentElement.id.replace('block', ''));
    } else {
        blockId = parseInt(event.currentTarget.id.replace('block', ''));
    }
    
    // 更新选中的区块
    selectedBlock = blockId;
    
    // 显示旋转按钮
    const buttons = document.querySelectorAll('.rotate-btn');
    buttons.forEach(btn => {
        btn.style.display = 'inline-block';
        // 确保按钮可以继续点击
        btn.disabled = false;
    });
    
    // 重置所有区块的边框
    document.querySelectorAll('.block').forEach(block => {
        block.style.border = '3px solid #333';
    });
    
    // 高亮当前选中的区块
    document.getElementById(`block${blockId}`).style.border = '3px solid red';
}

// 修改旋转区块函数
function rotate(direction) {
    if (!selectedBlock || gameOver || !needRotation || !myTurn) return;
    
    const block = selectedBlock - 1;
    const blockElement = document.getElementById(`block${selectedBlock}`);
    if (!blockElement) return;

    // 发送旋转信息给服务器
    socket.emit('rotateBlock', { 
        blockId: block, 
        direction: direction 
    });

    // 执行旋转动画和逻辑
    performRotation(block, direction);
}

// 修改执行旋转的函数
function performRotation(blockId, direction) {
    const blockElement = document.getElementById(`block${blockId + 1}`);
    const cells = blockElement.getElementsByClassName('cell');
    const newBoard = [...gameBoard[blockId]];

    // 添加旋转动画类
    if (direction === 'clockwise') {
        blockElement.classList.add('rotating-clockwise');
    } else {
        blockElement.classList.add('rotating-counterclockwise');
    }

    // 等待动画完成后更新棋盘
    setTimeout(() => {
        // 更新游戏状态
        if (direction === 'clockwise') {
            gameBoard[blockId] = [
                newBoard[6], newBoard[3], newBoard[0],
                newBoard[7], newBoard[4], newBoard[1],
                newBoard[8], newBoard[5], newBoard[2]
            ];
        } else {
            gameBoard[blockId] = [
                newBoard[2], newBoard[5], newBoard[8],
                newBoard[1], newBoard[4], newBoard[7],
                newBoard[0], newBoard[3], newBoard[6]
            ];
        }

        // 更新视图
        updateBlockView(blockId);

        // 移除动画类
        blockElement.classList.remove('rotating-clockwise', 'rotating-counterclockwise');

        // 重置状态
        needRotation = false;
        myTurn = false;
        selectedBlock = null;

        // 隐藏旋转按钮
        const buttons = document.querySelectorAll('.rotate-btn');
        buttons.forEach(btn => {
            btn.style.display = 'none';
            btn.disabled = false;  // 确保按钮重置为可用状态
        });

        // 重置区块边框
        document.querySelectorAll('.block').forEach(block => {
            block.style.border = '3px solid #333';
            block.style.pointerEvents = 'auto';  // 确保区块可以继续点击
        });

        updateStatus();

        // 检查胜利
        const winner = checkWin();
        if (winner) {
            gameOver = true;
            alert(`${winner === 'black' ? '黑子' : '白子'}获胜！`);
        }
    }, 500); // 动画持续时间
}

// 添加更新区块视图的函数
function updateBlockView(blockId) {
    const blockElement = document.getElementById(`block${blockId + 1}`);
    const cells = blockElement.getElementsByClassName('cell');
    
    // 清空所有格子
    Array.from(cells).forEach(cell => cell.innerHTML = '');
    
    // 重新放置棋子
    gameBoard[blockId].forEach((value, index) => {
        if (value) {
            const piece = document.createElement('div');
            piece.className = value;
            cells[index].appendChild(piece);
        }
    });
}

// 确保 initializeSocket 是全局函数
window.initializeSocket = function() {
    socket = io();
    const roomId = prompt('请输入房间号：');
    if (!roomId) return;

    socket.emit('joinRoom', roomId);

    // 所有 socket 事件监听器都移到这里
    socket.on('playerAssigned', (color) => {
        playerColor = color;
        alert(`你被分配为${color === 'black' ? '黑子' : '白子'}`);
        if (color === 'black') {
            myTurn = true;
        }
        updateStatus();
    });

    socket.on('moveMade', (data) => {
        if (data.player !== playerColor) {
            const block = parseInt(data.blockId);
            const cell = parseInt(data.cellIndex);
            
            // 更新对手的落子
            gameBoard[block][cell] = data.player;
            const blockElement = document.getElementById(`block${block + 1}`);
            const cells = blockElement.getElementsByClassName('cell');
            const piece = document.createElement('div');
            piece.className = data.player;
            cells[cell].appendChild(piece);
            
            // 等待对手旋转
            updateStatus();
        }
    });

    socket.on('blockRotated', (data) => {
        if (data.player !== playerColor) {
            // 执行相同的旋转动画和逻辑
            performRotation(data.blockId, data.direction);
            
            // 轮到我方回合
            setTimeout(() => {
                myTurn = true;
                needRotation = false;
                updateStatus();
            }, 500); // 等待动画完成
        }
    });
}

// 初始化游戏
createBoard();

