const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('用户连接成功');

    socket.on('joinRoom', (roomId) => {
        console.log('用户尝试加入房间:', roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                players: [socket.id],
                currentPlayer: 0,
                board: Array(4).fill().map(() => Array(9).fill(null))
            });
            socket.emit('playerAssigned', 'black');
            console.log('创建新房间，分配黑子');
        } else {
            const room = rooms.get(roomId);
            if (room.players.length < 2) {
                room.players.push(socket.id);
                socket.emit('playerAssigned', 'white');
                console.log('加入已有房间，分配白子');
            } else {
                socket.emit('roomFull');
                console.log('房间已满');
                return;
            }
        }
        socket.join(roomId);
        socket.roomId = roomId;
    });

    socket.on('makeMove', (data) => {
        console.log('收到下棋请求:', data);
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const playerIndex = room.players.indexOf(socket.id);
        if (playerIndex !== room.currentPlayer) return;

        io.to(socket.roomId).emit('moveMade', {
            blockId: data.blockId,
            cellIndex: data.cellIndex,
            player: playerIndex === 0 ? 'black' : 'white'
        });
        console.log('广播下棋信息');
    });

    socket.on('rotateBlock', (data) => {
        console.log('收到旋转请求:', data);
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const playerIndex = room.players.indexOf(socket.id);
        if (playerIndex !== room.currentPlayer) return;

        io.to(socket.roomId).emit('blockRotated', {
            blockId: data.blockId,
            direction: data.direction,
            player: playerIndex === 0 ? 'black' : 'white'
        });

        room.currentPlayer = 1 - room.currentPlayer;
        console.log('广播旋转信息，切换玩家');
    });

    socket.on('disconnect', () => {
        console.log('用户断开连接');
        if (socket.roomId && rooms.has(socket.roomId)) {
            const room = rooms.get(socket.roomId);
            room.players = room.players.filter(id => id !== socket.id);
            if (room.players.length === 0) {
                rooms.delete(socket.roomId);
                console.log('房间已清空');
            } else {
                io.to(socket.roomId).emit('playerLeft');
                console.log('通知对手玩家离开');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});