(() => {
  const $ = (sel) => document.querySelector(sel);
  const screens = {};
  document.querySelectorAll('.screen').forEach((el) => (screens[el.id] = el));

  function showScreen(id) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[id].classList.add('active');
    document.body.classList.toggle('page-home', id === 'screen-home');
    if (id === 'screen-home' && typeof renderRankPanel === 'function') renderRankPanel();
  }
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.back));
  });

  const nameInput = $('#playerNameInput');
  nameInput.value = localStorage.getItem('dino_name') || '';
  nameInput.addEventListener('change', () => localStorage.setItem('dino_name', nameInput.value.trim()));
  function getName() {
    const n = nameInput.value.trim() || `Dino${Math.floor(Math.random() * 900 + 100)}`;
    localStorage.setItem('dino_name', n);
    return n;
  }

  // ---------- auth ----------
  const authBar = $('#authBar');
  function renderAuthBar() {
    const user = Auth.getUser();
    if (user) {
      authBar.innerHTML = `<span class="auth-status">Logado como <b>${escapeHtml(user.name)}</b></span> <button class="btn-tiny" id="btnLogout">Sair</button>`;
      $('#btnLogout').addEventListener('click', async () => { await Auth.logout(); renderAuthBar(); });
    } else {
      authBar.innerHTML = `<button class="btn-tiny" id="btnOpenAuth">Entrar / Criar conta</button>`;
      $('#btnOpenAuth').addEventListener('click', () => { $('#authError').textContent = ''; showScreen('screen-auth'); });
    }
  }
  Auth.onChange(() => {
    renderAuthBar();
    const user = Auth.getUser();
    if (user) {
      nameInput.value = user.name;
      localStorage.setItem('dino_name', user.name);
      if (user.highScore > getHighScore()) localStorage.setItem('dino_highscore', String(user.highScore));
    }
    if (typeof renderRankPanel === 'function') renderRankPanel();
    if (typeof renderShop === 'function') renderShop();
  });

  let authMode = 'login';
  function setAuthMode(mode) {
    authMode = mode;
    $('#tabLogin').classList.toggle('active', mode === 'login');
    $('#tabRegister').classList.toggle('active', mode === 'register');
    $('#authNameField').style.display = mode === 'register' ? 'flex' : 'none';
    $('#authTitle').textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
    $('#btnAuthSubmit').textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
    $('#authError').textContent = '';
  }
  $('#tabLogin').addEventListener('click', () => setAuthMode('login'));
  $('#tabRegister').addEventListener('click', () => setAuthMode('register'));
  setAuthMode('login');

  $('#btnAuthSubmit').addEventListener('click', async () => {
    const email = $('#authEmailInput').value.trim();
    const password = $('#authPasswordInput').value;
    $('#authError').textContent = '';
    const result = authMode === 'login'
      ? await Auth.login({ email, password })
      : await Auth.register({ email, password, name: $('#authNameInput').value.trim() });
    if (!result.ok) { $('#authError').textContent = result.error || 'Algo deu errado.'; return; }
    $('#authEmailInput').value = '';
    $('#authPasswordInput').value = '';
    showScreen('screen-home');
  });

  function getSavedColor() {
    const id = localStorage.getItem('dino_color');
    return DINO_COLORS.some((c) => c.id === id) ? id : 'gray';
  }
  function setSavedColor(id) {
    localStorage.setItem('dino_color', id);
    selectedColor = id;
    paintBrand();
    renderHomeColors();
  }
  let selectedColor = getSavedColor();

  function paintBrand() {
    if (typeof drawBrandDino === 'function') {
      drawBrandDino($('#brandDino'), colorById(selectedColor).hex);
    }
  }
  DinoArt.onReady(paintBrand);
  paintBrand();

  function renderColorPicker(container, opts) {
    const taken = new Set(opts.taken || []);
    const current = opts.current;
    container.innerHTML = '';
    DINO_COLORS.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch' + (c.id === current ? ' selected' : '');
      btn.style.background = c.hex;
      btn.title = c.name;
      btn.disabled = taken.has(c.id) && c.id !== current;
      btn.addEventListener('click', () => { if (btn.disabled) return; opts.onPick(c.id); });
      container.appendChild(btn);
    });
  }

  function renderHomeColors() {
    renderColorPicker($('#homeColorPicker'), {
      current: selectedColor,
      taken: [],
      onPick: (id) => setSavedColor(id),
    });
  }
  renderHomeColors();
  renderAuthBar();
  Auth.refresh();

  // ---------- RANK PANEL UNIFICADO ----------
  async function renderRankPanel() {
    const top = await Auth.getLeaderboard();
    const pointsEl = $('#rankPoints');
    const coinsEl = $('#rankCoins');
    const points = Array.isArray(top) ? top : (top && top.points) || [];
    const coins = Array.isArray(top) ? [...top].sort((a,b)=>(b.coins||0)-(a.coins||0)) : (top && top.coins) || [];
    const row = (r, i, key) => `
      <div class="rank-row">
        <span class="rank-num">${i+1}</span>
        <span class="rank-name">${escapeHtml(r.name)}</span>
        <span class="rank-val ${key==='coins'?'rank-val-coins':''}">${padScore(key==='coins' ? (r.coins||0) : (r.highScore||0))}</span>
      </div>`;
    pointsEl.innerHTML = points.length ? points.map((r,i)=>row(r,i,'points')).join('') : `<div class="rank-empty">— sem dados —</div>`;
    coinsEl.innerHTML = coins.length ? coins.map((r,i)=>row(r,i,'coins')).join('') : `<div class="rank-empty">— sem dados —</div>`;
  }
  renderRankPanel();

  // ---------- scores locais ----------
  function getHighScore() { return parseInt(localStorage.getItem('dino_highscore')||'0',10); }
  function setHighScore(v) { if (v>getHighScore()) localStorage.setItem('dino_highscore',String(v)); }
  function padScore(n) { return String(n).padStart(5,'0'); }

  // ---------- moedas ----------
  function getLocalCoins() { return parseInt(localStorage.getItem('dino_coins')||'0',10); }
  function addLocalCoins(v) {
    if (v<=0) return getLocalCoins();
    const total = getLocalCoins()+v;
    localStorage.setItem('dino_coins',String(total));
    return total;
  }
  function spendLocalCoins(v) {
    const bal = getLocalCoins();
    if (bal < v) return false;
    localStorage.setItem('dino_coins', String(bal-v));
    return true;
  }
  function getWalletBalance() {
    const user = Auth.getUser();
    return user ? (user.coins||0) : getLocalCoins();
  }

  function applyServerLoadout(user) {
    if (!user || !user.loadout) return;
    const L = user.loadout;
    localStorage.setItem('dino_owned_skins', JSON.stringify(L.skins || ['classic']));
    localStorage.setItem('dino_owned_scenes', JSON.stringify(L.scenes || ['desert']));
    localStorage.setItem('dino_owned_accessories', JSON.stringify(L.accessories || ['none']));
    localStorage.setItem('dino_skin', L.skin || 'classic');
    localStorage.setItem('dino_scene', L.scene || 'desert');
    localStorage.setItem('dino_accessory', L.accessory || 'none');
  }

  function persistLoadout() {
    if (!Auth.getUser()) return;
    Auth.saveLoadout({
      skins: getOwnedSkins(),
      scenes: getOwnedScenes(),
      accessories: getOwnedAccessories(),
      skin: getEquippedSkin(),
      scene: getEquippedScene(),
      accessory: getEquippedAccessory(),
    });
  }

  Auth.onChange((user) => {
    if (user) applyServerLoadout(user);
    else {
      localStorage.setItem('dino_owned_skins', JSON.stringify(['classic']));
      localStorage.setItem('dino_owned_scenes', JSON.stringify(['desert']));
      localStorage.setItem('dino_owned_accessories', JSON.stringify(['none']));
      localStorage.setItem('dino_skin', 'classic');
      localStorage.setItem('dino_scene', 'desert');
      localStorage.setItem('dino_accessory', 'none');
    }
    paintBrand();
    if (typeof renderShop === 'function') renderShop();
  });
  async function syncRunCoins(amount) {
    if (amount<=0) return;
    if (Auth.getUser()) { await Auth.earnCoins(amount); }
    else { addLocalCoins(amount); }
    renderShop();
  }

  // ---------- LOJA ----------
  let shopTab = 'skins';
  document.querySelectorAll('.shop-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      shopTab = btn.dataset.tab;
      document.querySelectorAll('.shop-tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderShop();
    });
  });

  function shopCatalog() {
    if (shopTab === 'skins') {
      return {
        list: SKINS, owned: getOwnedSkins(), equipped: getEquippedSkin(),
        equip: setEquippedSkin, own: addOwnedSkin, freeIds: ['classic'],
      };
    }
    if (shopTab === 'scenes') {
      return {
        list: SCENES, owned: getOwnedScenes(), equipped: getEquippedScene(),
        equip: setEquippedScene, own: addOwnedScene, freeIds: ['desert'],
      };
    }
    return {
      list: ACCESSORIES, owned: getOwnedAccessories(), equipped: getEquippedAccessory(),
      equip: setEquippedAccessory, own: addOwnedAccessory, freeIds: ['none'],
    };
  }

  function renderShop() {
    if (!$('#shopGrid')) return;
    const bal = getWalletBalance();
    $('#shopCoinsDisplay').textContent = padScore(bal);
    const cat = shopCatalog();
    const equippedItem = cat.list.find((a) => a.id === cat.equipped) || cat.list[0];
    $('#shopEquippedName').textContent = equippedItem ? equippedItem.name : '—';
    const grid = $('#shopGrid');
    grid.innerHTML = '';
    cat.list.forEach((a) => {
      const isOwned = cat.owned.includes(a.id) || cat.freeIds.includes(a.id);
      const isEquipped = cat.equipped === a.id;
      const canBuy = !isOwned && bal >= a.cost;
      const card = document.createElement('div');
      card.className = 'shop-card' + (isEquipped ? ' shop-card--equipped' : '');
      const price = cat.freeIds.includes(a.id)
        ? 'gratis'
        : (isOwned ? (isEquipped ? 'equipado' : 'possudo') : `$ ${padScore(a.cost)}`);
      card.innerHTML = `
        <img class="shop-card-img" src="${a.img}" alt="${a.name}" />
        <div class="shop-card-name">${a.name}</div>
        <div class="shop-card-rarity" style="color:${RARITY_COLORS[a.rarity]}">${a.rarity}</div>
        <div class="shop-card-price">${price}</div>`;
      card.addEventListener('click', () => {
        if (isOwned) { cat.equip(a.id); persistLoadout(); paintBrand(); renderShop(); return; }
        if (!canBuy) { alert('Moedas insuficientes.'); return; }
        if (!confirmPurchase(a, bal)) return;
        doSpendCoins(a.cost).then((ok) => {
          if (ok) { cat.own(a.id); cat.equip(a.id); persistLoadout(); paintBrand(); renderShop(); }
        });
      });
      grid.appendChild(card);
    });
  }

  function confirmPurchase(acc, bal) {
    return confirm(`Comprar "${acc.name}" por ${acc.cost} moedas?\nSaldo atual: ${bal}`);
  }

  async function doSpendCoins(amount) {
    const user = Auth.getUser();
    if (user) {
      const res = await fetch('/api/economy/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.ok) { Auth._forceUser && Auth._forceUser(data.user); await Auth.refresh(); return true; }
      alert(data.error || 'Moedas insuficientes.');
      return false;
    } else {
      const ok = spendLocalCoins(amount);
      if (!ok) { alert('Moedas insuficientes.'); return false; }
      return true;
    }
  }

  $('#btnShop').addEventListener('click', () => { renderShop(); showScreen('screen-shop'); });

  // ---------- ROLETA DIARIA ----------
  const WHEEL_SLICES = [
    { label: '10', kind: 'coins', amount: 10, color: '#e74c3c' },
    { label: 'nada', kind: 'none', color: '#2d2d2d' },
    { label: '25', kind: 'coins', amount: 25, color: '#f1c40f' },
    { label: 'item', kind: 'item', color: '#8e44ad' },
    { label: '50', kind: 'coins', amount: 50, color: '#27ae60' },
    { label: 'nada', kind: 'none', color: '#2980b9' },
    { label: '15', kind: 'coins', amount: 15, color: '#e67e22' },
    { label: '100', kind: 'coins', amount: 100, color: '#1abc9c' },
  ];
  let wheelAngle = 0;
  let wheelSpinning = false;

  function lastDailySpin() {
    return parseInt(localStorage.getItem('dino_daily_spin') || '0', 10);
  }
  function canDailySpin() {
    return Date.now() - lastDailySpin() >= 24 * 60 * 60 * 1000;
  }
  function hoursLeftSpin() {
    const left = 24 * 60 * 60 * 1000 - (Date.now() - lastDailySpin());
    return Math.max(0, Math.ceil(left / 3600000));
  }

  function drawDailyWheel(highlight) {
    const canvas = $('#dailyWheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = 118, R = 96;
    const n = WHEEL_SLICES.length;
    const arc = (Math.PI * 2) / n;
    WHEEL_SLICES.forEach((s, i) => {
      const a0 = wheelAngle + i * arc - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a0 + arc);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a0 + arc / 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Courier New';
      ctx.textAlign = 'right';
      ctx.fillText(s.label, R - 8, 4);
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.fillStyle = '#f3efe6';
    ctx.beginPath();
    ctx.moveTo(cx, 14);
    ctx.lineTo(cx - 10, 34);
    ctx.lineTo(cx + 10, 34);
    ctx.closePath();
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 18, cy + R + 8, 36, 14);
    ctx.fillRect(cx - 28, cy + R + 20, 56, 10);
    if (highlight != null) {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(highlight, cx, H - 8);
    }
  }
  drawDailyWheel();

  function refreshSpinButton() {
    const btn = $('#btnDailySpin');
    const meta = $('#dailySpinMeta');
    if (!btn) return;
    if (canDailySpin()) {
      btn.disabled = false;
      btn.textContent = 'Girar gratis';
      meta.textContent = '1 giro gratis a cada 24h · extra custa $50';
    } else {
      btn.disabled = getWalletBalance() < 50;
      btn.textContent = 'Girar por $50';
      meta.textContent = `Gratis em ~${hoursLeftSpin()}h · ou pague 50 moedas`;
    }
  }
  refreshSpinButton();

  $('#btnDailySpin').addEventListener('click', async () => {
    if (wheelSpinning) return;
    const free = canDailySpin();
    if (!free) {
      if (getWalletBalance() < 50) { $('#dailySpinResult').textContent = 'precisa de 50 moedas'; return; }
      const paid = await doSpendCoins(50);
      if (!paid) { $('#dailySpinResult').textContent = 'sem moedas'; return; }
    }
    wheelSpinning = true;
    $('#btnDailySpin').disabled = true;
    $('#dailySpinResult').textContent = '...';
    const idx = Math.floor(Math.random() * WHEEL_SLICES.length);
    const n = WHEEL_SLICES.length;
    const arc = 360 / n;
    const extra = 360 * 6;
    const target = extra + (360 - (idx * arc + arc / 2));
    const start = wheelAngle;
    const dest = (target * Math.PI) / 180;
    const t0 = performance.now();
    const dur = 3200;
    function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      wheelAngle = start + dest * e;
      drawDailyWheel();
      if (p < 1) requestAnimationFrame(tick);
      else finishDailySpin(WHEEL_SLICES[idx]);
    }
    requestAnimationFrame(tick);
  });

  async function finishDailySpin(prize) {
    if (canDailySpin()) localStorage.setItem('dino_daily_spin', String(Date.now()));
    wheelSpinning = false;
    refreshSpinButton();
    if (prize.kind === 'coins') {
      if (Auth.getUser()) await Auth.earnCoins(prize.amount);
      else addLocalCoins(prize.amount);
      $('#dailySpinResult').textContent = `+${prize.amount} moedas`;
    } else if (prize.kind === 'item') {
      const pool = ACCESSORIES.filter((a) => a.id !== 'none');
      const acc = pool[Math.floor(Math.random() * pool.length)];
      addOwnedAccessory(acc.id);
      setEquippedAccessory(acc.id);
      persistLoadout();
      paintBrand();
      $('#dailySpinResult').textContent = `item: ${acc.name}`;
    } else {
      $('#dailySpinResult').textContent = 'nada dessa vez';
    }
    renderShop();
    refreshSpinButton();
  }

  $('#btnToggleRank').addEventListener('click', () => $('#rankDock').classList.toggle('collapsed'));
  $('#btnToggleWheel').addEventListener('click', () => $('#wheelDock').classList.toggle('collapsed'));

  // ---------- socket ----------
  let socket = null;
  function ensureSocket() {
    if (!socket) { socket = io(); wireSocketEvents(); }
    const user = Auth.getUser();
    if (user) socket.emit('auth:hello', { userId: user.id, name: user.name });
    return socket;
  }

  let currentRoom = null;
  let browsingRooms = [];

  function wireSocketEvents() {
    socket.on('rooms:list', (list) => {
      browsingRooms = list;
      if (screens['screen-browse'].classList.contains('active')) renderRoomList();
    });
    socket.on('room:update', (room) => {
      currentRoom = room;
      if (screens['screen-lobby'].classList.contains('active')) renderLobby();
    });
    socket.on('chat:msg', (msg) => appendChat(msg));
    socket.on('friend:incoming', (msg) => {
      const line = (msg && msg.fromName) ? (msg.fromName + ' quer ser seu amigo') : 'Novo pedido de amizade';
      if ($('#friendError')) $('#friendError').textContent = line;
      if (screens['screen-friends'] && screens['screen-friends'].classList.contains('active')) loadFriends();
    });
    socket.on('game:start', ({ seed, players }) => { startMultiGame(seed, players); });
    socket.on('game:state', (state) => { if (activeGame) activeGame.updateRemote(state.players); });
    socket.on('game:end', ({ results }) => {
      stopUpdateLoop();
      if (activeGame) { activeGame.destroy(); activeGame = null; }
      if (!coinsSynced) { coinsSynced=true; syncRunCoins(currentRunCoins); }
      showMultiResults(results);
    });
  }

  let activeGame = null;
  $('#btnSolo').addEventListener('click', () => startSoloGame());
  const pauseBtn = $('#btnPause');
  if (pauseBtn) pauseBtn.addEventListener('click', () => activeGame && activeGame.togglePause());
  const btnResume = $('#btnResume');
  if (btnResume) btnResume.addEventListener('click', () => activeGame && activeGame.paused && activeGame.togglePause());
  const btnGiveUp = $('#btnGiveUp');
  if (btnGiveUp) btnGiveUp.addEventListener('click', () => {
    $('#pauseOverlay').classList.remove('active');
    $('#giveUpOverlay').classList.add('active');
  });
  const btnGiveUpNo = $('#btnGiveUpNo');
  if (btnGiveUpNo) btnGiveUpNo.addEventListener('click', () => {
    $('#giveUpOverlay').classList.remove('active');
    $('#pauseOverlay').classList.add('active');
  });
  const btnGiveUpYes = $('#btnGiveUpYes');
  if (btnGiveUpYes) btnGiveUpYes.addEventListener('click', () => {
    $('#giveUpOverlay').classList.remove('active');
    goHome();
  });

  function startSoloGame() {
    if (activeGame) { activeGame.destroy(); activeGame = null; }
    showScreen('screen-game');
    $('#waitingOverlay').classList.remove('active');
    $('#gameOverOverlay').classList.remove('active');
    $('#hudHigh').textContent = padScore(getHighScore());
    $('#hudCoins').textContent = padScore(0);
    const canvas = $('#gameCanvas');
    const seed = Math.floor(Math.random()*1e9);
    let runCoins = 0;
    $('#btnPause').style.display = 'inline-block';
    $('#btnPause').textContent = 'pausar';
    $('#pauseOverlay').classList.remove('active');
    if ($('#giveUpOverlay')) $('#giveUpOverlay').classList.remove('active');
    activeGame = new Game(canvas, {
      mode: 'solo',
      seed,
      highScore: getHighScore(),
      players: [{ id:'local', name:getName(), isLocal:true, isBot:false, color:selectedColor, accessory: getEquippedAccessory(), skin: getEquippedSkin(), scene: getEquippedScene() }],
      onScoreTick: (score) => { $('#hudScore').textContent = padScore(score); },
      onPauseChange: (paused) => {
        $('#pauseOverlay').classList.toggle('active', !!paused);
        $('#btnPause').textContent = paused ? 'continuar' : 'pausar';
      },
      onCoinsEarned: (amount, total) => { runCoins=total; $('#hudCoins').textContent = padScore(total); },
      onLocalDeath: (score) => {
        setHighScore(score);
        $('#hudHigh').textContent = padScore(getHighScore());
        const hsSync = Auth.getUser() ? Auth.syncHighScore(score) : Promise.resolve();
        Promise.resolve(hsSync)
          .then(() => syncRunCoins(runCoins))
          .then(() => renderRankPanel());
        showSoloGameOver(score);
      },
    });
    runCountdown(() => activeGame.start());
  }

  function showSoloGameOver(score) { $('#gameOverOverlay').classList.add('active'); }

  $('#btnRestart').addEventListener('click', () => {
    if ($('#gameOverOverlay').classList.contains('active')) startSoloGame();
  });
  window.addEventListener('keydown', (e) => {
    if (!$('#gameOverOverlay').classList.contains('active')) return;
    if (e.code==='Space'||e.code==='ArrowUp') { e.preventDefault(); startSoloGame(); }
  });

  $('#btnMulti').addEventListener('click', () => { ensureSocket(); showScreen('screen-mp-menu'); });

  const maxRange = $('#maxPlayersRange');
  maxRange.addEventListener('input', () => { $('#maxPlayersLabel').textContent = maxRange.value; });
  $('#btnCreateRoom').addEventListener('click', () => { $('#createError').textContent=''; showScreen('screen-create'); });

  $('#btnConfirmCreate').addEventListener('click', () => {
    const name = $('#roomNameInput').value.trim();
    const password = $('#roomPasswordInput').value.trim();
    const maxPlayers = parseInt(maxRange.value,10);
    const fillBots = $('#fillBotsCheck').checked;
    ensureSocket().emit('rooms:create',{name,playerName:getName(),password,maxPlayers,fillBots,color:selectedColor,skin:getEquippedSkin(),accessory:getEquippedAccessory(),scene:getEquippedScene()},(res)=>{
      if (!res.ok) { $('#createError').textContent=res.error||'Erro ao criar sala.'; return; }
      currentRoom=res.room;
      const me=currentRoom.players.find(p=>p.id===socket.id);
      if (me&&me.color) setSavedColor(me.color);
      clearChat();
      renderLobby(); showScreen('screen-lobby');
    });
  });

  $('#btnBrowseRooms').addEventListener('click', () => { showScreen('screen-browse'); ensureSocket().emit('rooms:list'); });
  $('#btnRefreshRooms').addEventListener('click', () => ensureSocket().emit('rooms:list'));
  $('#roomSearchInput').addEventListener('input', renderRoomList);

  function renderRoomList() {
    const q = $('#roomSearchInput').value.trim().toLowerCase();
    const filtered = browsingRooms.filter(r=>r.name.toLowerCase().includes(q));
    const el = $('#roomList');
    if (!filtered.length) { el.innerHTML=`<div class="room-empty">Nenhuma sala encontrada. Que tal criar uma?</div>`; return; }
    el.innerHTML = filtered.map(r=>`
      <div class="room-item" data-id="${r.id}">
        <div>
          <div class="room-title">${r.hasPassword?'# ':''}${escapeHtml(r.name)}</div>
          <div class="room-meta">${r.playerCount}/${r.maxPlayers} jogadores · ${r.state==='lobby'?'aguardando':r.state==='playing'?'em partida':'reiniciando'}</div>
        </div>
        <div>${r.state==='lobby'?'>':'...'}</div>
      </div>`).join('');
    el.querySelectorAll('.room-item').forEach(item=>{
      item.addEventListener('click',()=>joinRoom(item.dataset.id));
    });
  }

  function joinRoom(roomId) {
    const room = browsingRooms.find(r=>r.id===roomId);
    if (!room) return;
    if (room.state!=='lobby') { alert('Essa sala ja esta em partida. Escolha outra ou aguarde.'); return; }
    let password = '';
    if (room.hasPassword) { password = prompt('Essa sala tem senha:')||''; }
    ensureSocket().emit('rooms:join',{roomId,playerName:getName(),password,color:selectedColor,skin:getEquippedSkin(),accessory:getEquippedAccessory(),scene:getEquippedScene()},(res)=>{
      if (!res.ok) { alert(res.error||'Nao foi possivel entrar na sala.'); return; }
      currentRoom=res.room;
      const me=currentRoom.players.find(p=>p.id===socket.id);
      if (me&&me.color) setSavedColor(me.color);
      clearChat();
      renderLobby(); showScreen('screen-lobby');
    });
  }

  function appendChat(msg) {
    const log = $('#lobbyChatLog');
    if (!log || !msg) return;
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.innerHTML = `<b>${escapeHtml(msg.name || 'Jogador')}:</b> ${escapeHtml(msg.text || '')}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }
  function clearChat() {
    const log = $('#lobbyChatLog');
    if (log) log.innerHTML = '<div class="chat-sys">chat da sala</div>';
  }
  function sendLobbyChat() {
    const input = $('#lobbyChatInput');
    if (!input || !socket) return;
    const text = input.value.trim();
    if (!text) return;
    socket.emit('chat:send', { text });
    input.value = '';
  }
  const chatSend = $('#btnLobbyChatSend');
  if (chatSend) chatSend.addEventListener('click', sendLobbyChat);
  const chatInput = $('#lobbyChatInput');
  if (chatInput) chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendLobbyChat(); }
  });

  function renderLobby() {
    if (!currentRoom) return;
    $('#lobbyRoomName').textContent = currentRoom.name;
    $('#lobbyRoomCode').textContent = currentRoom.id;
    const isHost = currentRoom.hostId===socket.id;
    $('#lobbyPlayers').innerHTML = currentRoom.players.map(p=>{
      const hex = colorById(p.color).hex;
      const mine = p.id===socket.id;
      return `
      <div class="lobby-player">
        <span class="swatch" style="background:${hex}"></span>
        <span style="flex:1">${escapeHtml(p.name)}${mine?' (voce)':''}</span>
        <span class="tag">${p.id===currentRoom.hostId?'HOST':(p.isBot?'BOT':'')}</span>
      </div>`;
    }).join('');
    $('#btnStartGame').style.display = isHost?'block':'none';
    $('#lobbyHint').textContent = isHost
      ? `Ate ${currentRoom.maxPlayers} jogadores${currentRoom.fillBots?' · vagas vazias viram bots ao comecar':''}`
      : 'Aguardando o host comecar a partida...';
    const taken = currentRoom.players.filter(p=>p.id!==socket.id).map(p=>p.color);
    const me = currentRoom.players.find(p=>p.id===socket.id);
    if (me&&me.color) selectedColor=me.color;
    renderColorPicker($('#lobbyColorPicker'),{
      current:selectedColor, taken,
      onPick:(id)=>{ selectedColor=id; localStorage.setItem('dino_color',id); paintBrand(); socket.emit('player:setColor',{color:id}); },
    });
  }

  $('#btnCopyCode').addEventListener('click', () => {
    if (currentRoom) navigator.clipboard?.writeText(currentRoom.id).catch(()=>{});
  });
  $('#btnStartGame').addEventListener('click', () => socket.emit('room:start'));
  $('#btnLeaveLobby').addEventListener('click', () => {
    socket.emit('room:leave'); currentRoom=null; showScreen('screen-mp-menu');
  });

  let updateInterval=null;
  function stopUpdateLoop() { if(updateInterval){clearInterval(updateInterval);updateInterval=null;} }
  let currentRunCoins=0, coinsSynced=false;

  function startMultiGame(seed, playersFromServer) {
    if (activeGame) { activeGame.destroy(); activeGame=null; }
    stopUpdateLoop();
    showScreen('screen-game');
    $('#waitingOverlay').classList.remove('active');
    $('#gameOverOverlay').classList.remove('active');
    $('#btnPause').style.display = 'none';
    $('#pauseOverlay').classList.remove('active');
    $('#hudHigh').textContent = padScore(getHighScore());
    $('#hudCoins').textContent = padScore(0);
    const canvas = $('#gameCanvas');
    const players = playersFromServer.map(p=>({
      id:p.id, name:p.name, isBot:p.isBot, isLocal:p.id===socket.id, color:p.color||'gray',
      accessory: p.id===socket.id ? getEquippedAccessory() : (p.accessory || 'none'),
      skin: p.id===socket.id ? getEquippedSkin() : (p.skin || 'classic'),
      scene: p.id===socket.id ? getEquippedScene() : (p.scene || 'desert'),
    }));
    let runCoins=0; currentRunCoins=0; coinsSynced=false;
    activeGame = new Game(canvas,{
      mode:'multi', seed, players,
      onScoreTick:(score)=>{ $('#hudScore').textContent=padScore(score); },
      onCoinsEarned:(amount,total)=>{ runCoins=total; currentRunCoins=total; $('#hudCoins').textContent=padScore(total); },
      onLocalDeath:()=>{}, onAllDone:()=>{},
    });
    runCountdown(()=>{
      activeGame.start();
      let lastDead=false;
      updateInterval=setInterval(()=>{
        if (!activeGame) return;
        const p=activeGame.local;
        socket.emit('game:update',{distance:p.distance,alive:p.alive});
        if (p.alive) { setHighScore(Math.floor(p.distance/10)); }
        if (!p.alive&&!lastDead) {
          lastDead=true;
          $('#waitingOverlay').classList.add('active');
          if (!coinsSynced){coinsSynced=true;syncRunCoins(runCoins);}
        }
      },150);
    });
  }

  function showMultiResults(results) {
    stopUpdateLoop();
    $('#waitingOverlay').classList.remove('active');
    const medals=['🥇','🥈','🥉'];
    $('#resultsList').innerHTML = results.map((r,i)=>`
      <div class="result-item ${i===0?'first':''}">
        <div class="result-rank">${medals[i]||(i+1)}</div>
        <div style="flex:1;padding:0 10px;">${r.isBot?'[bot] ':''}${escapeHtml(r.name)}${r.id===socket.id?' (voce)':''}</div>
        <div><b>${padScore(Math.floor((r.score||0)/10))}</b></div>
      </div>`).join('');
    $('#btnPlayAgain').onclick=()=>{showScreen('screen-lobby');renderLobby();};
    showScreen('screen-results');
  }

  function goHome() {
    $('#gameOverOverlay').classList.remove('active');
    $('#waitingOverlay').classList.remove('active');
    $('#pauseOverlay') && $('#pauseOverlay').classList.remove('active');
    $('#giveUpOverlay') && $('#giveUpOverlay').classList.remove('active');
    if ($('#btnPause')) $('#btnPause').style.display = 'none';
    if (socket&&currentRoom) socket.emit('room:leave');
    currentRoom=null;
    if (activeGame) { activeGame.destroy(); activeGame=null; }
    showScreen('screen-home');
    paintBrand();
    renderHomeColors();
    renderRankPanel();
    renderShop();
  }

  $('#btnBackHome').addEventListener('click', goHome);
  $('#btnGameOverMenu').addEventListener('click', goHome);

  function runCountdown(done) {
    const el=$('#countdown');
    let n=3; el.textContent=n; Sound.countdown();
    const t=setInterval(()=>{
      n--;
      if (n>0){el.textContent=n;Sound.countdown();}
      else if(n===0){el.textContent='VAI!';Sound.go();}
      else{clearInterval(t);el.textContent='';done();}
    },700);
  }

  $('#touchJump').addEventListener('touchstart',(e)=>{e.preventDefault();activeGame?.handleInput('jump');});
  $('#touchDown').addEventListener('touchstart',(e)=>{e.preventDefault();activeGame?.handleInput('duckdown');});
  $('#touchDown').addEventListener('touchend',(e)=>{e.preventDefault();activeGame?.handleInput('duckup');});
  const canvasEl=$('#gameCanvas');
  canvasEl.addEventListener('touchstart',(e)=>{
    const rect=canvasEl.getBoundingClientRect();
    const y=e.touches[0].clientY-rect.top;
    if(y<rect.height/2) activeGame?.handleInput('jump'); else activeGame?.handleInput('duckdown');
  });
  canvasEl.addEventListener('touchend',()=>activeGame?.handleInput('duckup'));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function refreshAccountButtons() {
    const user = Auth.getUser();
    $('#btnFriends').style.display = user ? 'block' : 'none';
    $('#btnAdmin').style.display = user && user.isAdmin ? 'block' : 'none';
    window.DINO_ADMIN = (user && user.isAdmin)
      ? { immortal: !!user.immortal, speedScale: typeof user.speedScale === 'number' ? user.speedScale : 1 }
      : { immortal: false, speedScale: 1 };
    if (user) ensureSocket();
  }
  Auth.onChange(refreshAccountButtons);
  refreshAccountButtons();

  $('#btnFriends').addEventListener('click', () => {
    ensureSocket();
    loadFriends();
    showScreen('screen-friends');
  });
  $('#btnAdmin').addEventListener('click', () => { loadAdmin(); showScreen('screen-admin'); });

  async function loadFriends() {
    $('#friendError').textContent = '';
    try {
      const res = await fetch('/api/friends', { credentials:'same-origin' });
      const data = await res.json();
      if (!data.ok) { $('#friendError').textContent = data.error || 'Erro'; return; }
      $('#friendIncoming').innerHTML = (data.incoming||[]).length
        ? data.incoming.map((f)=>`<div class="friend-row"><span>${escapeHtml(f.name)}</span><button type="button" class="btn-tiny btn-accept-friend" data-id="${f.id}">aceitar</button></div>`).join('')
        : '<div class="friend-empty">nenhum pedido</div>';
      const outgoing = data.outgoing || [];
      const friendsHtml = (data.friends||[]).map((f)=>{
        const status = f.online ? (f.roomState==='playing' ? 'em jogo' : (f.roomState==='lobby' ? 'na sala' : 'online')) : 'offline';
        const canJoin = f.online && f.roomId && f.roomState === 'lobby';
        return `<div class="friend-row" data-room="${f.roomId||''}"><span>${escapeHtml(f.name)} · ${status}</span>${canJoin ? '<button type="button" class="btn-tiny btn-join-friend">entrar</button>' : ''}</div>`;
      }).join('');
      const outHtml = outgoing.map((f)=>`<div class="friend-row"><span>${escapeHtml(f.name)}</span><span>enviado</span></div>`).join('');
      $('#friendList').innerHTML = (friendsHtml + outHtml) || '<div class="friend-empty">sem amigos ainda</div>';
      document.querySelectorAll('.btn-accept-friend').forEach((btn) => {
        btn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = btn.getAttribute('data-id');
          const res = await fetch('/api/friends/accept', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }), credentials:'same-origin' });
          const out = await res.json().catch(() => ({ ok:false }));
          if (!out.ok) { $('#friendError').textContent = out.error || 'Nao deu para aceitar.'; return; }
          $('#friendError').textContent = 'Agora voces sao amigos.';
          loadFriends();
        });
      });
      document.querySelectorAll('.btn-join-friend').forEach((btn) => {
        btn.addEventListener('click', () => {
          const roomId = btn.parentElement.dataset.room;
          if (!roomId) return;
          ensureSocket().emit('rooms:join-friend', {
            roomId, playerName: getName(), password: '',
            color: selectedColor, skin: getEquippedSkin(),
            accessory: getEquippedAccessory(), scene: getEquippedScene(),
          }, (res) => {
            if (!res.ok) { $('#friendError').textContent = res.error || 'Nao entrou na sala.'; return; }
            currentRoom = res.room;
            clearChat();
            renderLobby();
            showScreen('screen-lobby');
          });
        });
      });
    } catch (e) {
      $('#friendError').textContent = 'Nao conectou.';
    }
  }

  $('#btnFriendAdd').addEventListener('click', async () => {
    $('#friendError').textContent = '';
    const name = $('#friendNameInput').value.trim();
    const res = await fetch('/api/friends/request', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }), credentials:'same-origin' });
    const data = await res.json();
    if (!data.ok) { $('#friendError').textContent = data.error || 'Erro'; return; }
    $('#friendNameInput').value = '';
    $('#friendError').textContent = 'Pedido enviado.';
    loadFriends();
  });

  async function loadAdmin() {
    $('#adminError').textContent = '';
    const user = Auth.getUser() || {};
    const scale = typeof user.speedScale === 'number' ? user.speedScale : 1;
    $('#adminImmortal').checked = !!user.immortal;
    $('#adminSpeedRange').value = String(Math.round(scale * 10));
    $('#adminSpeedLabel').textContent = scale.toFixed(1) + 'x';
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (!data.ok) { $('#adminError').textContent = data.error || 'Sem permissao.'; return; }
    $('#adminUsers').innerHTML = data.users.map((u)=>`
      <div class="room-item admin-user" data-name="${escapeHtml(u.name)}" data-email="${escapeHtml(u.email)}">
        <div><div class="room-title">${escapeHtml(u.name)}</div>
        <div class="room-meta">${escapeHtml(u.email)} · $ ${u.coins} · HI ${u.highScore}</div></div>
      </div>`).join('');
    document.querySelectorAll('.admin-user').forEach((row) => {
      row.addEventListener('click', () => {
        $('#adminTargetInput').value = row.dataset.name || row.dataset.email;
      });
    });
  }

  $('#adminSpeedRange').addEventListener('input', () => {
    $('#adminSpeedLabel').textContent = (parseInt($('#adminSpeedRange').value,10)/10).toFixed(1) + 'x';
  });

  $('#btnAdminSaveCheats').addEventListener('click', async () => {
    const immortal = $('#adminImmortal').checked;
    const speedScale = parseInt($('#adminSpeedRange').value, 10) / 10;
    const res = await fetch('/api/admin/cheats', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ immortal, speedScale }),
    });
    const data = await res.json();
    if (!data.ok) { $('#adminError').textContent = data.error || 'Erro'; return; }
    window.DINO_ADMIN = { immortal, speedScale };
    await Auth.refresh();
    $('#adminError').textContent = immortal
      ? `salvo: imortal ligado · velocidade ${speedScale.toFixed(1)}x`
      : `salvo: imortal desligado · velocidade ${speedScale.toFixed(1)}x`;
  });

  $('#btnAdminResetRank').addEventListener('click', async () => {
    if (!confirm('Zerar o ranking de pontos de todo mundo?')) return;
    const res = await fetch('/api/admin/reset-rank', { method:'POST' });
    const data = await res.json();
    if (!data.ok) { $('#adminError').textContent = data.error || 'Erro'; return; }
    localStorage.setItem('dino_highscore', '0');
    renderRankPanel();
    $('#adminError').textContent = 'ranking resetado';
  });

  $('#btnAdminSetCoins').addEventListener('click', async () => {
    $('#adminError').textContent = '';
    const target = $('#adminTargetInput').value.trim();
    const amount = parseInt($('#adminCoinsInput').value, 10);
    const res = await fetch('/api/admin/set-coins', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ target, amount }),
    });
    const data = await res.json();
    if (!data.ok) { $('#adminError').textContent = data.error || 'Erro'; return; }
    $('#adminError').textContent = `ok: ${data.user.name} agora tem ${data.user.coins}`;
    loadAdmin();
    Auth.refresh();
  });

  const addCoinsBtn = $('#btnAdminAddCoins');
  if (addCoinsBtn) addCoinsBtn.addEventListener('click', async () => {
    $('#adminError').textContent = '';
    const target = $('#adminTargetInput').value.trim();
    const amount = parseInt($('#adminCoinsInput').value, 10);
    const res = await fetch('/api/admin/set-coins', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ target, amount, mode: 'add' }),
    });
    const data = await res.json();
    if (!data.ok) { $('#adminError').textContent = data.error || 'Erro'; return; }
    $('#adminError').textContent = `ok: ${data.user.name} agora tem ${data.user.coins}`;
    loadAdmin();
    Auth.refresh();
  });
})();
