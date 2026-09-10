const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { obstacleAt, TRACK_START } = require('./public/js/rng.js');
const { DINO_COLORS, firstFreeColor } = require('./public/js/colors.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

/** @type {Map<string, Room>} */
const rooms = new Map();

const BOT_NAMES = [
  'Rex Turbo', 'Trex Veloz', 'Saurinho', 'Ptero Furio', 'Spino Bot',
  'Rapta Vel', 'Cacto Man', 'Deserto Bot', 'Turbo Raptor', 'Dino Zero'
];

function randomBotName(taken) {
  const opts = BOT_NAMES.filter((n) => !taken.includes(n));
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : `Bot ${Math.floor(Math.random() * 999)}`;
}

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function isValidColor(id) {
  return DINO_COLORS.some((c) => c.id === id);
}

function speedAt(elapsedMs) {
  const t = elapsedMs / 1000;
  return 300 + Math.min(t * 18, 260);
}

class Room {
  constructor({ id, name, hostId, hostName, password, maxPlayers, fillBots, color }) {
    this.id = id;
    this.name = name || `Sala de ${hostName}`;
    this.hostId = hostId;
    this.password = password || null;
    this.maxPlayers = Math.min(4, Math.max(2, maxPlayers || 4));
    this.fillBots = !!fillBots;
    this.state = 'lobby';
    this.players = new Map();
    this.seed = null;
    this.startedAt = null;
    this.tickTimer = null;
    this.addPlayer(hostId, hostName, false, color);
  }

  get humanCount() {
    return [...this.players.values()].filter((p) => !p.isBot).length;
  }

  takenColors(exceptId) {
    return [...this.players.values()]
      .filter((p) => p.id !== exceptId)
      .map((p) => p.color);
  }

  pickColor(wanted, exceptId) {
    const taken = this.takenColors(exceptId);
    if (wanted && isValidColor(wanted) && !taken.includes(wanted)) return wanted;
    return firstFreeColor(taken);
  }

  toSummary() {
    return {
      id: this.id,
      name: this.name,
      hasPassword: !!this.password,
      maxPlayers: this.maxPlayers,
      playerCount: this.humanCount,
      state: this.state,
    };
  }

  toRoomState() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      fillBots: this.fillBots,
      hasPassword: !!this.password,
      state: this.state,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, isBot: p.isBot, alive: p.alive,
        distance: Math.floor(p.distance || 0), color: p.color,
      })),
    };
  }

  addPlayer(id, name, isBot, color) {
    this.players.set(id, {
      id, name: (name || 'Jogador').slice(0, 16), isBot,
      alive: true, distance: 0,
      color: this.pickColor(color, id),
      skill: 0.92 + Math.random() * 0.06,
      reacted: -1,
      failAt: 0,
    });
  }

  setColor(id, color) {
    if (this.state !== 'lobby') return false;
    const p = this.players.get(id);
    if (!p || !isValidColor(color)) return false;
    if (this.takenColors(id).includes(color)) return false;
    p.color = color;
    return true;
  }

  removePlayer(id) {
    this.players.delete(id);
    if (id === this.hostId) {
      const next = [...this.players.values()].find((p) => !p.isBot);
      this.hostId = next ? next.id : null;
    }
  }

  fillWithBots() {
    const slots = this.maxPlayers - this.players.size;
    const takenNames = [...this.players.values()].map((p) => p.name);
    for (let i = 0; i < slots; i++) {
      const botId = `bot_${this.id}_${i}_${Date.now()}`;
      const name = randomBotName(takenNames);
      takenNames.push(name);
      this.addPlayer(botId, name, true, null);
    }
  }

  start(ioRef) {
    this.state = 'playing';
    this.seed = Math.floor(Math.random() * 1e9);
    this.startedAt = Date.now();
    this.obstacleDistances = [TRACK_START || 560];
    let cum = TRACK_START || 560;
    for (let i = 0; i < 2000; i++) {
      const o = obstacleAt(this.seed, i);
      cum += o.gap;
      this.obstacleDistances.push(cum);
    }
    for (const p of this.players.values()) {
      p.alive = true;
      p.distance = 0;
      p.reacted = 0;
      const roll = Math.random();
      if (roll < 0.015) {
        // bem raro: pode ir ate ~80 mil pontos
        p.skill = 0.992;
        p.failAt = 350000 + Math.random() * 500000;
        p.legend = true;
      } else if (roll < 0.08) {
        p.skill = 0.97;
        p.failAt = 25000 + Math.random() * 50000;
        p.legend = false;
      } else {
        p.skill = 0.88 + Math.random() * 0.08;
        p.failAt = 3500 + Math.random() * 14000;
        p.legend = false;
      }
    }

    ioRef.to(this.id).emit('game:start', { seed: this.seed, players: this.toRoomState().players });

    let last = Date.now();
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const elapsed = now - this.startedAt;
      const spd = speedAt(elapsed);

      for (const p of this.players.values()) {
        if (!p.isBot || !p.alive) continue;
        p.distance += spd * dt;

        if (p.distance >= p.failAt) {
          p.alive = false;
          continue;
        }

        const dinoX = p.distance + 78;
        while (p.reacted + 1 < this.obstacleDistances.length) {
          const nextIdx = p.reacted + 1;
          const obsDist = this.obstacleDistances[nextIdx];
          if (obsDist === undefined) break;
          if (dinoX + 8 < obsDist) break;
          p.reacted = nextIdx;
          if (obsDist < 40 || nextIdx < 4) continue;
          const tired = p.legend
            ? Math.min(0.06, p.distance / 2500000)
            : Math.min(0.32, Math.max(0, (p.distance - 2000) / 16000));
          const success = Math.random() < Math.max(0.60, p.skill - tired);
          if (!success) {
            p.alive = false;
            p.distance = Math.max(0, obsDist - 78);
            break;
          }
        }
      }

      const allDead = [...this.players.values()].every((p) => !p.alive);
      ioRef.to(this.id).emit('game:state', {
        players: [...this.players.values()].map((p) => ({
          id: p.id, name: p.name, isBot: p.isBot, alive: p.alive,
          distance: Math.floor(p.distance), color: p.color,
        })),
      });

      if (allDead) {
        this.finish(ioRef);
      }
    }, 140);
  }

  finish(ioRef) {
    clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.state = 'finished';
    const results = [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: Math.floor(p.distance), color: p.color }))
      .sort((a, b) => b.score - a.score);
    ioRef.to(this.id).emit('game:end', { results });
    setTimeout(() => {
      if (!rooms.has(this.id)) return;
      this.state = 'lobby';
      for (const p of this.players.values()) { p.alive = true; p.distance = 0; }
      for (const [id, p] of this.players.entries()) if (p.isBot) this.players.delete(id);
      broadcastRoomList();
      ioRef.to(this.id).emit('room:update', this.toRoomState());
    }, 3500);
  }
}

function broadcastRoomList() {
  const list = [...rooms.values()].map((r) => r.toSummary());
  io.emit('rooms:list', list);
}

io.on('connection', (socket) => {
  socket.on('rooms:list', () => {
    socket.emit('rooms:list', [...rooms.values()].map((r) => r.toSummary()));
  });

  socket.on('rooms:create', ({ name, playerName, password, maxPlayers, fillBots, color }, cb) => {
    const id = makeRoomId();
    const room = new Room({ id, name, hostId: socket.id, hostName: playerName, password, maxPlayers, fillBots, color });
    rooms.set(id, room);
    socket.join(id);
    socket.data.roomId = id;
    socket.data.playerName = playerName;
    cb && cb({ ok: true, room: room.toRoomState() });
    broadcastRoomList();
  });

  socket.on('rooms:join', ({ roomId, playerName, password, color }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb && cb({ ok: false, error: 'Sala nao encontrada.' });
    if (room.state !== 'lobby') return cb && cb({ ok: false, error: 'Essa sala ja comecou a partida.' });
    if (room.password && room.password !== password) return cb && cb({ ok: false, error: 'Senha incorreta.' });
    if (room.humanCount >= room.maxPlayers) return cb && cb({ ok: false, error: 'Sala cheia.' });

    room.addPlayer(socket.id, playerName, false, color);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = playerName;
    cb && cb({ ok: true, room: room.toRoomState() });
    io.to(roomId).emit('room:update', room.toRoomState());
    broadcastRoomList();
  });

  socket.on('player:setColor', ({ color }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (room.setColor(socket.id, color)) {
      io.to(room.id).emit('room:update', room.toRoomState());
    }
  });

  socket.on('room:leave', () => leaveCurrentRoom(socket));

  socket.on('room:start', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.hostId !== socket.id || room.state !== 'lobby') return;
    if (room.fillBots) room.fillWithBots();
    room.start(io);
    broadcastRoomList();
  });

  socket.on('game:update', ({ distance, alive }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (p && !p.isBot) { p.distance = distance; p.alive = alive; }
  });

  socket.on('disconnect', () => leaveCurrentRoom(socket));

  function leaveCurrentRoom(sock) {
    const roomId = sock.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    sock.leave(roomId);
    sock.data.roomId = null;
    if (!room) return;
    room.removePlayer(sock.id);
    if (room.humanCount === 0) {
      if (room.tickTimer) clearInterval(room.tickTimer);
      rooms.delete(roomId);
    } else {
      io.to(roomId).emit('room:update', room.toRoomState());
    }
    broadcastRoomList();
  }
});

server.listen(PORT, () => {
  console.log(`Dino Multiplayer rodando em http://localhost:${PORT}`);
});
