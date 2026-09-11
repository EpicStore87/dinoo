// Armazenamento de usuários em arquivo JSON local (sem precisar de banco de
// dados de verdade — funciona bem pra um projeto desse tamanho). As senhas
// nunca são salvas em texto puro, só o hash gerado pelo bcrypt.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf8');
}

function loadUsers() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return []; }
}

function saveUsers(users) {
  ensureFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || 'admin@dino.online')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function isAdminUser(u) {
  return !!(u && (u.isAdmin || ADMIN_EMAILS.includes(String(u.email || '').toLowerCase())));
}

function publicUser(u) {
  return {
    id: u.id, email: u.email, name: u.name,
    highScore: u.highScore || 0, coins: u.coins || 0,
    isAdmin: isAdminUser(u),
    immortal: !!u.immortal,
    speedScale: typeof u.speedScale === 'number' ? u.speedScale : 1,
    loadout: u.loadout || defaultLoadout(),
  };
}

function defaultLoadout() {
  return {
    skins: ['classic'],
    scenes: ['desert'],
    accessories: ['none'],
    skin: 'classic',
    scene: 'desert',
    accessory: 'none',
  };
}

function findByEmail(email) {
  const target = String(email || '').trim().toLowerCase();
  return loadUsers().find((u) => u.email === target);
}

function findById(id) {
  return loadUsers().find((u) => u.id === id);
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}
function levenshtein(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) {
    m[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) m[0][j] = j;
      else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
      }
    }
  }
  return m[a.length][b.length];
}
function namesTooClose(a, b) {
  // so bloqueia nome identico (Miguel = Miguel).
  // Miguel e Miguel098 sao nomes diferentes.
  return !!a && !!b && a === b;
}

function register({ email, password, name }) {
  email = String(email || '').trim().toLowerCase();
  name = String(name || '').trim().slice(0, 16) || 'Jogador';
  if (!email || !email.includes('@') || !email.includes('.')) {
    return { ok: false, error: 'Digite um e-mail válido.' };
  }
  if (!password || String(password).length < 6) {
    return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };
  }
  const users = loadUsers();
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: 'Já existe uma conta com esse e-mail.' };
  }
  const wanted = normalizeName(name);
  if (wanted.length < 3) return { ok: false, error: 'O nome precisa ter pelo menos 3 letras.' };
  if (users.some((u) => namesTooClose(normalizeName(u.name), wanted))) {
    return { ok: false, error: 'Esse nome ja esta em uso.' };
  }
  const user = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    email,
    name,
    passwordHash: bcrypt.hashSync(String(password), 10),
    highScore: 0,
    coins: 0,
    loadout: defaultLoadout(),
    createdAt: Date.now(),
  };
  users.push(user);
  saveUsers(users);
  return { ok: true, user: publicUser(user) };
}

function login({ email, password }) {
  const user = findByEmail(email);
  if (!user) return { ok: false, error: 'E-mail ou senha incorretos.' };
  const match = bcrypt.compareSync(String(password || ''), user.passwordHash);
  if (!match) return { ok: false, error: 'E-mail ou senha incorretos.' };
  return { ok: true, user: publicUser(user) };
}

function updateHighScore(id, score) {
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  if (score > (user.highScore || 0)) {
    user.highScore = score;
    saveUsers(users);
  }
  return publicUser(user);
}

function addCoins(id, amount) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (amount === 0) return findPublicById(id);
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  user.coins = (user.coins || 0) + amount;
  saveUsers(users);
  return publicUser(user);
}

function spendCoins(id, amount) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  const users = loadUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return { ok: false, error: 'Usuário não encontrado.' };
  if ((user.coins || 0) < amount) return { ok: false, error: 'Moedas insuficientes.' };
  user.coins -= amount;
  saveUsers(users);
  return { ok: true, user: publicUser(user) };
}

function findPublicById(id) {
  const user = findById(id);
  return user ? publicUser(user) : null;
}

function getLeaderboard(limit) {
  limit = limit || 10;
  const users = loadUsers();
  const byPoints = [...users]
    .filter((u) => (u.highScore || 0) > 0)
    .sort((a, b) => (b.highScore || 0) - (a.highScore || 0))
    .slice(0, limit)
    .map((u) => ({ name: u.name, highScore: u.highScore || 0, coins: u.coins || 0 }));
  const byCoins = [...users]
    .filter((u) => (u.coins || 0) > 0)
    .sort((a, b) => (b.coins || 0) - (a.coins || 0))
    .slice(0, limit)
    .map((u) => ({ name: u.name, highScore: u.highScore || 0, coins: u.coins || 0 }));
  return { points: byPoints, coins: byCoins };
}

function listUsersAdmin() {
  return loadUsers().map((u) => ({
    id: u.id, email: u.email, name: u.name,
    coins: u.coins || 0, highScore: u.highScore || 0, isAdmin: isAdminUser(u),
  }));
}

function setCoinsTo(target, amount, mode) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  const users = loadUsers();
  const key = String(target || '').trim().toLowerCase();
  const user = users.find((u) => u.email === key || String(u.name).toLowerCase() === key || u.id === target)
    || findUserByNameOrEmail(target);
  if (!user) return { ok: false, error: 'Jogador nao encontrado. Use o nome da conta ou o e-mail.' };
  if (mode === 'add') user.coins = (user.coins || 0) + amount;
  else user.coins = amount;
  saveUsers(users);
  return { ok: true, user: publicUser(user) };
}

function findUserByNameOrEmail(raw, exceptId) {
  const wanted = normalizeName(raw);
  const email = String(raw || '').trim().toLowerCase();
  const rawLower = String(raw || '').trim().toLowerCase();
  const users = loadUsers();
  return users.find((u) => {
    if (exceptId && u.id === exceptId) return false;
    if (email && u.email === email) return true;
    if (normalizeName(u.name) === wanted && wanted) return true;
    return String(u.name || '').trim().toLowerCase() === rawLower;
  }) || null;
}

function getFriends(userId) {
  const users = loadUsers();
  const me = users.find((u) => u.id === userId);
  if (!me) return { friends: [], incoming: [], outgoing: [] };
  const pack = (id) => {
    const u = users.find((x) => x.id === id);
    return u ? { id: u.id, name: u.name } : null;
  };
  const incomingIds = new Set(me.requests || []);
  users.forEach((u) => {
    if (u.id !== userId && (u.outgoing || []).includes(userId)) incomingIds.add(u.id);
  });
  (me.friends || []).forEach((id) => incomingIds.delete(id));
  const outgoingIds = (me.outgoing || []).filter((id) => !(me.friends || []).includes(id));
  return {
    friends: (me.friends || []).map(pack).filter(Boolean),
    incoming: [...incomingIds].map(pack).filter(Boolean),
    outgoing: outgoingIds.map(pack).filter(Boolean),
  };
}

function requestFriend(fromId, name) {
  const users = loadUsers();
  const me = users.find((u) => u.id === fromId);
  if (!me) return { ok: false, error: 'Nao logado.' };
  const other = findUserByNameOrEmail(name, fromId);
  if (!other) return { ok: false, error: 'Nao achei uma conta com esse nome ou e-mail.' };
  me.friends = me.friends || [];
  me.outgoing = me.outgoing || [];
  me.requests = me.requests || [];
  other.friends = other.friends || [];
  other.requests = other.requests || [];
  other.outgoing = other.outgoing || [];
  if (me.friends.includes(other.id) || other.friends.includes(me.id)) {
    return { ok: false, error: 'Voces ja sao amigos.' };
  }
  if (me.requests.includes(other.id)) {
    // ja tinha pedido do outro: aceita na hora
    return acceptFriend(fromId, other.id);
  }
  if (!other.requests.includes(me.id)) other.requests.push(me.id);
  if (!me.outgoing.includes(other.id)) me.outgoing.push(other.id);
  saveUsers(users);
  return { ok: true, sentTo: other.name, sentToId: other.id };
}

function setAdminCheats(adminId, { immortal, speedScale }) {
  const users = loadUsers();
  const user = users.find((u) => u.id === adminId);
  if (!user || !isAdminUser(user)) return { ok: false, error: 'Sem permissao.' };
  if (typeof immortal === 'boolean') user.immortal = immortal;
  if (speedScale != null) user.speedScale = Math.max(0.5, Math.min(3, Number(speedScale) || 1));
  saveUsers(users);
  return { ok: true, user: publicUser(user) };
}

function saveLoadout(userId, loadout) {
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { ok: false, error: 'Nao logado.' };
  const cur = user.loadout || defaultLoadout();
  const next = Object.assign({}, cur, loadout || {});
  next.skins = Array.from(new Set(['classic'].concat(next.skins || [])));
  next.scenes = Array.from(new Set(['desert'].concat(next.scenes || [])));
  next.accessories = Array.from(new Set(['none'].concat(next.accessories || [])));
  user.loadout = next;
  saveUsers(users);
  return { ok: true, user: publicUser(user) };
}

function resetRanking() {
  const users = loadUsers();
  users.forEach((u) => { u.highScore = 0; });
  saveUsers(users);
  return { ok: true };
}

function acceptFriend(myId, fromId) {
  const users = loadUsers();
  const me = users.find((u) => u.id === myId);
  let other = users.find((u) => u.id === fromId);
  if (!other && fromId) other = findUserByNameOrEmail(fromId, myId);
  if (!me || !other) return { ok: false, error: 'Pedido invalido.' };
  me.friends = me.friends || [];
  other.friends = other.friends || [];
  me.requests = (me.requests || []).filter((id) => id !== fromId);
  other.outgoing = (other.outgoing || []).filter((id) => id !== myId);
  me.outgoing = (me.outgoing || []).filter((id) => id !== fromId);
  other.requests = (other.requests || []).filter((id) => id !== myId);
  if (!me.friends.includes(other.id)) me.friends.push(other.id);
  if (!other.friends.includes(me.id)) other.friends.push(me.id);
  saveUsers(users);
  return { ok: true, friends: getFriends(myId) };
}

module.exports = {
  register, login, findById, findByEmail, updateHighScore, publicUser,
  getLeaderboard, addCoins, spendCoins, findPublicById,
  isAdminUser, listUsersAdmin, setCoinsTo, getFriends, requestFriend, acceptFriend,
  setAdminCheats, resetRanking, saveLoadout, defaultLoadout,
};
