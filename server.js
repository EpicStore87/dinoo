const path = require('path');
const express = require('express');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const { obstacleAt, TRACK_START } = require('./public/js/rng.js');
const { DINO_COLORS, firstFreeColor } = require('./public/js/colors.js');
const authStore = require('./auth-store.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SESSION_SECRET = process.env.SESSION_SECRET || 'dino-online-troque-essa-chave-em-producao';
if (!process.env.SESSION_SECRET) {
  console.warn('[aviso] Usando uma chave de sessão padrão. Defina a variável de ambiente SESSION_SECRET antes de colocar isso no ar de verdade.');
}

app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, sameSite: 'lax' }, // 30 dias
}));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- rotas de conta (e-mail/senha) ----------
app.post('/api/auth/register', (req, res) => {
  const result = authStore.register(req.body || {});
  if (!result.ok) return res.status(400).json(result);
  req.session.userId = result.user.id;
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const result = authStore.login(req.body || {});
  if (!result.ok) return res.status(401).json(result);
  req.session.userId = result.user.id;
  res.json(result);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  const user = req.session.userId && authStore.findById(req.session.userId);
  if (!user) return res.json({ ok: false });
  res.json({ ok: true, user: authStore.publicUser(user) });
});

app.post('/api/auth/highscore', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Não logado.' });
  const score = Math.max(0, Math.floor(Number(req.body && req.body.score) || 0));
  const user = authStore.updateHighScore(req.session.userId, score);
  if (!user) return res.status(404).json({ ok: false });
  res.json({ ok: true, user });
});

app.get('/api/leaderboard', (req, res) => {
  res.json({ ok: true, top: authStore.getLeaderboard(10) });
});

app.post('/api/economy/earn', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Não logado.' });
  const amount = Math.max(0, Math.floor(Number(req.body && req.body.amount) || 0));
  const user = authStore.addCoins(req.session.userId, amount);
  if (!user) return res.status(404).json({ ok: false });
  res.json({ ok: true, user });
});

app.post('/api/economy/spend', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Não logado.' });
  const amount = Math.max(0, Math.floor(Number(req.body && req.body.amount) || 0));
  const result = authStore.spendCoins(req.session.userId, amount);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/account/loadout', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Não logado.' });
  const result = authStore.saveLoadout(req.session.userId, req.body || {});
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

function sessionUser(req) {
  return req.session.userId && authStore.findById(req.session.userId);
}

app.get('/api/admin/users', (req, res) => {
  const user = sessionUser(req);
  if (!authStore.isAdminUser(user)) return res.status(403).json({ ok: false, error: 'Sem permissao.' });
  res.json({ ok: true, users: authStore.listUsersAdmin() });
});

app.post('/api/admin/set-coins', (req, res) => {
  const user = sessionUser(req);
  if (!authStore.isAdminUser(user)) return res.status(403).json({ ok: false, error: 'Sem permissao.' });
  const result = authStore.setCoinsTo(req.body && req.body.target, req.body && req.body.amount, req.body && req.body.mode);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/admin/cheats', (req, res) => {
  const user = sessionUser(req);
  if (!authStore.isAdminUser(user)) return res.status(403).json({ ok: false, error: 'Sem permissao.' });
  const result = authStore.setAdminCheats(user.id, req.body || {});
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/admin/reset-rank', (req, res) => {
  const user = sessionUser(req);
  if (!authStore.isAdminUser(user)) return res.status(403).json({ ok: false, error: 'Sem permissao.' });
  res.json(authStore.resetRanking());
});

const onlineUsers = new Map(); // userId -> { socketId, name }

function presenceOf(userId) {
  try {
  const online = onlineUsers.has(userId);
  let roomId = null;
  let roomState = null;
  if (online) {
    const sockId = onlineUsers.get(userId).socketId;
    const sock = io.sockets.sockets.get(sockId);
    if (sock && sock.data.roomId) {
      const room = rooms.get(sock.data.roomId);
      if (room) {
        roomId = room.id;
        roomState = room.state;
      }
    }
  }
  return { online, roomId, roomState };
  } catch (e) {
    return { online: false, roomId: null, roomState: null };
  }
}

function decorateFriends(list) {
  return (list || []).map((f) => Object.assign({}, f, presenceOf(f.id)));
}

app.get('/api/friends', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Entre na conta para usar amigos.' });
  const pack = authStore.getFriends(req.session.userId);
  res.json({
    ok: true,
    friends: decorateFriends(pack.friends),
    incoming: decorateFriends(pack.incoming),
    outgoing: decorateFriends(pack.outgoing),
  });
});

app.post('/api/friends/request', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Entre na conta para usar amigos.' });
  const result = authStore.requestFriend(req.session.userId, req.body && req.body.name);
  if (!result.ok) return res.status(400).json(result);
  const me = authStore.findById(req.session.userId);
  if (result.sentToId && onlineUsers.has(result.sentToId)) {
    const info = onlineUsers.get(result.sentToId);
    io.to(info.socketId).emit('friend:incoming', { fromId: req.session.userId, fromName: me && me.name });
  }
  res.json(result);
});

app.post('/api/friends/accept', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Entre na conta para usar amigos.' });
  const result = authStore.acceptFriend(req.session.userId, req.body && req.body.id);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

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
  return 340 + Math.min(t * 36, 360);
}

class Room {
  constructor({ id, name, hostId, hostName, password, maxPlayers, fillBots, color, skin, accessory, scene }) {
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
    this.addPlayer(hostId, hostName, false, color, { skin, accessory, scene });
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
        skin: p.skin || 'classic', accessory: p.accessory || 'none', scene: p.scene || 'desert',
      })),
    };
  }

  addPlayer(id, name, isBot, color, cosmetics) {
    cosmetics = cosmetics || {};
    const skins = ['classic','godzilla','gold','ghost'];
    const accs = ['none','straw','cap','bow','flower','glasses','pirate','santa','crown'];
    const scenes = ['desert','forest','snow','night'];
    this.players.set(id, {
      id, name: (name || 'Jogador').slice(0, 16), isBot,
      alive: true, distance: 0,
      color: this.pickColor(color, id),
      skin: isBot ? skins[Math.floor(Math.random()*skins.length)] : (cosmetics.skin || 'classic'),
      accessory: isBot ? accs[Math.floor(Math.random()*accs.length)] : (cosmetics.accessory || 'none'),
      scene: isBot ? scenes[Math.floor(Math.random()*scenes.length)] : (cosmetics.scene || 'desert'),
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
          skin: p.skin, accessory: p.accessory, scene: p.scene,
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
      .map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: Math.floor(p.distance), color: p.color, skin: p.skin, accessory: p.accessory, scene: p.scene }))
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
  socket.on('auth:hello', ({ userId, name }) => {
    if (!userId) return;
    const user = authStore.findById(userId);
    if (!user) return;
    socket.data.userId = user.id;
    onlineUsers.set(user.id, { socketId: socket.id, name: user.name || name });
  });

  socket.on('rooms:list', () => {
    socket.emit('rooms:list', [...rooms.values()].map((r) => r.toSummary()));
  });

  socket.on('rooms:create', ({ name, playerName, password, maxPlayers, fillBots, color, skin, accessory, scene }, cb) => {
    const id = makeRoomId();
    const room = new Room({ id, name, hostId: socket.id, hostName: playerName, password, maxPlayers, fillBots, color, skin, accessory, scene });
    rooms.set(id, room);
    socket.join(id);
    socket.data.roomId = id;
    socket.data.playerName = playerName;
    cb && cb({ ok: true, room: room.toRoomState() });
    broadcastRoomList();
  });

  socket.on('rooms:join', ({ roomId, playerName, password, color, skin, accessory, scene }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb && cb({ ok: false, error: 'Sala nao encontrada.' });
    if (room.state !== 'lobby') return cb && cb({ ok: false, error: 'Essa sala ja comecou a partida.' });
    if (room.password && room.password !== password) return cb && cb({ ok: false, error: 'Senha incorreta.' });
    if (room.humanCount >= room.maxPlayers) return cb && cb({ ok: false, error: 'Sala cheia.' });

    room.addPlayer(socket.id, playerName, false, color, { skin, accessory, scene });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = playerName;
    cb && cb({ ok: true, room: room.toRoomState() });
    io.to(roomId).emit('room:update', room.toRoomState());
    broadcastRoomList();
  });

  socket.on('rooms:join-friend', ({ roomId, playerName, color, skin, accessory, scene }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb && cb({ ok: false, error: 'Sala nao encontrada.' });
    if (room.state !== 'lobby') return cb && cb({ ok: false, error: 'O amigo ja esta em partida.' });
    if (room.humanCount >= room.maxPlayers) return cb && cb({ ok: false, error: 'Sala cheia.' });
    const myId = socket.data.userId;
    if (!myId) return cb && cb({ ok: false, error: 'Entre na conta.' });
    const pack = authStore.getFriends(myId);
    const friendIds = new Set((pack.friends || []).map((f) => f.id));
    const friendInRoom = [...room.players.values()].some((p) => {
      const sock = io.sockets.sockets.get(p.id);
      return sock && sock.data.userId && friendIds.has(sock.data.userId);
    });
    if (!friendInRoom) return cb && cb({ ok: false, error: 'Esse jogador nao e seu amigo nesta sala.' });
    room.addPlayer(socket.id, playerName, false, color, { skin, accessory, scene });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = playerName;
    cb && cb({ ok: true, room: room.toRoomState() });
    io.to(roomId).emit('room:update', room.toRoomState());
    broadcastRoomList();
  });

  socket.on('chat:send', ({ text }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!clean) return;
    const name = socket.data.playerName || 'Jogador';
    io.to(room.id).emit('chat:msg', { name, text: clean, at: Date.now() });
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

  socket.on('disconnect', () => {
    if (socket.data.userId) {
      const cur = onlineUsers.get(socket.data.userId);
      if (cur && cur.socketId === socket.id) onlineUsers.delete(socket.data.userId);
    }
    leaveCurrentRoom(socket);
  });

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
