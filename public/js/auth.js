// Cuida do estado da conta logada no navegador, conversando com as rotas
// /api/auth/* do servidor. Outros arquivos (main.js) escutam mudanças via
// Auth.onChange(...).
const Auth = (() => {
  let user = null;
  const listeners = [];
  function notify() { listeners.forEach((fn) => fn(user)); }

  async function refresh() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      user = data.ok ? data.user : null;
    } catch (e) {
      user = null;
    }
    notify();
    return user;
  }

  async function register({ email, password, name }) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (data.ok) { user = data.user; notify(); }
      return data;
    } catch (e) {
      return { ok: false, error: 'Não foi possível conectar ao servidor.' };
    }
  }

  async function login({ email, password }) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.ok) { user = data.user; notify(); }
      return data;
    } catch (e) {
      return { ok: false, error: 'Não foi possível conectar ao servidor.' };
    }
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* segue o jogo */ }
    user = null;
    notify();
  }

  async function syncHighScore(score) {
    if (!user) return null;
    try {
      const res = await fetch('/api/auth/highscore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      const data = await res.json();
      if (data.ok) { user = data.user; notify(); }
      return data.ok ? data.user : null;
    } catch (e) {
      return null;
    }
  }

  async function getLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      return data.ok ? data.top : [];
    } catch (e) {
      return [];
    }
  }

  async function earnCoins(amount) {
    if (!user || amount <= 0) return null;
    try {
      const res = await fetch('/api/economy/earn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.ok) { user = data.user; notify(); }
      return data.ok ? data.user : null;
    } catch (e) {
      return null;
    }
  }

  async function saveLoadout(loadout) {
    if (!user) return null;
    try {
      const res = await fetch('/api/account/loadout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loadout),
      });
      const data = await res.json();
      if (data.ok) { user = data.user; notify(); }
      return data;
    } catch (e) {
      return { ok: false };
    }
  }

  return {
    getUser: () => user,
    onChange: (fn) => listeners.push(fn),
    refresh, register, login, logout, syncHighScore, getLeaderboard, earnCoins,
    saveLoadout,
  };
})();
