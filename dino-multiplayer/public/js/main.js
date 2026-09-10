(() => {
  const $ = (sel) => document.querySelector(sel);
  const screens = {};
  document.querySelectorAll('.screen').forEach((el) => (screens[el.id] = el));

  function showScreen(id) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[id].classList.add('active');
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
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        opts.onPick(c.id);
      });
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

  function getHighScore() {
    return parseInt(localStorage.getItem('dino_highscore') || '0', 10);
  }
  function setHighScore(v) {
    if (v > getHighScore()) localStorage.setItem('dino_highscore', String(v));
  }
  function padScore(n) {
    return String(n).padStart(5, '0');
  }
  $('#homeHighscore').textContent = getHighScore() > 0 ? `recorde ${padScore(getHighScore())}` : '';

  let socket = null;
  function ensureSocket() {
    if (!socket) {
      socket = io();
      wireSocketEvents();
    }
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
    socket.on('game:start', ({ seed, players }) => {
      startMultiGame(seed, players);
    });
    socket.on('game:state', (state) => {
      if (activeGame) activeGame.updateRemote(state.players);
    });
    socket.on('game:end', ({ results }) => {
      stopUpdateLoop();
      if (activeGame) { activeGame.destroy(); activeGame = null; }
      showMultiResults(results);
    });
  }

  let activeGame = null;

  $('#btnSolo').addEventListener('click', () => startSoloGame());

  function startSoloGame() {
    if (activeGame) { activeGame.destroy(); activeGame = null; }
    showScreen('screen-game');
    $('#waitingOverlay').classList.remove('active');
    $('#gameOverOverlay').classList.remove('active');
    $('#hudHigh').textContent = padScore(getHighScore());
    const canvas = $('#gameCanvas');
    const seed = Math.floor(Math.random() * 1e9);
    activeGame = new Game(canvas, {
      mode: 'solo',
      seed,
      highScore: getHighScore(),
      players: [{ id: 'local', name: getName(), isLocal: true, isBot: false, color: selectedColor }],
      onScoreTick: (score) => { $('#hudScore').textContent = padScore(score); },
      onLocalDeath: (score) => {
        setHighScore(score);
        $('#hudHigh').textContent = padScore(getHighScore());
        showSoloGameOver(score);
      },
    });
    runCountdown(() => activeGame.start());
  }

  function showSoloGameOver(score) {
    $('#gameOverOverlay').classList.add('active');
  }

  function showSoloResults(score) {
    showSoloGameOver(score);
  }

  $('#btnRestart').addEventListener('click', () => {
    if ($('#gameOverOverlay').classList.contains('active')) startSoloGame();
  });
  window.addEventListener('keydown', (e) => {
    if (!$('#gameOverOverlay').classList.contains('active')) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      startSoloGame();
    }
  });

  $('#btnMulti').addEventListener('click', () => { ensureSocket(); showScreen('screen-mp-menu'); });

  const maxRange = $('#maxPlayersRange');
  maxRange.addEventListener('input', () => { $('#maxPlayersLabel').textContent = maxRange.value; });
  $('#btnCreateRoom').addEventListener('click', () => { $('#createError').textContent = ''; showScreen('screen-create'); });

  $('#btnConfirmCreate').addEventListener('click', () => {
    const name = $('#roomNameInput').value.trim();
    const password = $('#roomPasswordInput').value.trim();
    const maxPlayers = parseInt(maxRange.value, 10);
    const fillBots = $('#fillBotsCheck').checked;
    ensureSocket().emit('rooms:create', {
      name, playerName: getName(), password, maxPlayers, fillBots, color: selectedColor,
    }, (res) => {
      if (!res.ok) { $('#createError').textContent = res.error || 'Erro ao criar sala.'; return; }
      currentRoom = res.room;
      const me = currentRoom.players.find((p) => p.id === socket.id);
      if (me && me.color) setSavedColor(me.color);
      renderLobby();
      showScreen('screen-lobby');
    });
  });

  $('#btnBrowseRooms').addEventListener('click', () => {
    showScreen('screen-browse');
    ensureSocket().emit('rooms:list');
  });
  $('#btnRefreshRooms').addEventListener('click', () => ensureSocket().emit('rooms:list'));
  $('#roomSearchInput').addEventListener('input', renderRoomList);

  function renderRoomList() {
    const q = $('#roomSearchInput').value.trim().toLowerCase();
    const filtered = browsingRooms.filter((r) => r.name.toLowerCase().includes(q));
    const el = $('#roomList');
    if (!filtered.length) {
      el.innerHTML = `<div class="room-empty">Nenhuma sala encontrada. Que tal criar uma?</div>`;
      return;
    }
    el.innerHTML = filtered.map((r) => `
      <div class="room-item" data-id="${r.id}">
        <div>
          <div class="room-title">${r.hasPassword ? '# ' : ''}${escapeHtml(r.name)}</div>
          <div class="room-meta">${r.playerCount}/${r.maxPlayers} jogadores · ${r.state === 'lobby' ? 'aguardando' : r.state === 'playing' ? 'em partida' : 'reiniciando'}</div>
        </div>
        <div>${r.state === 'lobby' ? '>' : '...'}</div>
      </div>`).join('');
    el.querySelectorAll('.room-item').forEach((item) => {
      item.addEventListener('click', () => joinRoom(item.dataset.id));
    });
  }

  function joinRoom(roomId) {
    const room = browsingRooms.find((r) => r.id === roomId);
    if (!room) return;
    let password = '';
    if (room.state !== 'lobby') { alert('Essa sala ja esta em partida. Escolha outra ou aguarde.'); return; }
    if (room.hasPassword) {
      password = prompt('Essa sala tem senha:') || '';
    }
    ensureSocket().emit('rooms:join', { roomId, playerName: getName(), password, color: selectedColor }, (res) => {
      if (!res.ok) { alert(res.error || 'Nao foi possivel entrar na sala.'); return; }
      currentRoom = res.room;
      const me = currentRoom.players.find((p) => p.id === socket.id);
      if (me && me.color) setSavedColor(me.color);
      renderLobby();
      showScreen('screen-lobby');
    });
  }

  function renderLobby() {
    if (!currentRoom) return;
    $('#lobbyRoomName').textContent = currentRoom.name;
    $('#lobbyRoomCode').textContent = currentRoom.id;
    const isHost = currentRoom.hostId === socket.id;
    $('#lobbyPlayers').innerHTML = currentRoom.players.map((p) => {
      const hex = colorById(p.color).hex;
      const mine = p.id === socket.id;
      return `
      <div class="lobby-player">
        <span class="swatch" style="background:${hex}"></span>
        <span style="flex:1">${escapeHtml(p.name)}${mine ? ' (voce)' : ''}</span>
        <span class="tag">${p.id === currentRoom.hostId ? 'HOST' : (p.isBot ? 'BOT' : '')}</span>
      </div>`;
    }).join('');
    $('#btnStartGame').style.display = isHost ? 'block' : 'none';
    $('#lobbyHint').textContent = isHost
      ? `Ate ${currentRoom.maxPlayers} jogadores${currentRoom.fillBots ? ' · vagas vazias viram bots ao comecar' : ''}`
      : 'Aguardando o host comecar a partida...';

    const taken = currentRoom.players
      .filter((p) => p.id !== socket.id)
      .map((p) => p.color);
    const me = currentRoom.players.find((p) => p.id === socket.id);
    if (me && me.color) selectedColor = me.color;
    renderColorPicker($('#lobbyColorPicker'), {
      current: selectedColor,
      taken,
      onPick: (id) => {
        selectedColor = id;
        localStorage.setItem('dino_color', id);
        paintBrand();
        socket.emit('player:setColor', { color: id });
      },
    });
  }

  $('#btnCopyCode').addEventListener('click', () => {
    if (currentRoom) navigator.clipboard?.writeText(currentRoom.id).catch(() => {});
  });

  $('#btnStartGame').addEventListener('click', () => socket.emit('room:start'));

  $('#btnLeaveLobby').addEventListener('click', () => {
    socket.emit('room:leave');
    currentRoom = null;
    showScreen('screen-mp-menu');
  });

  let updateInterval = null;
  function stopUpdateLoop() { if (updateInterval) { clearInterval(updateInterval); updateInterval = null; } }

  function startMultiGame(seed, playersFromServer) {
    if (activeGame) { activeGame.destroy(); activeGame = null; }
    stopUpdateLoop();
    showScreen('screen-game');
    $('#waitingOverlay').classList.remove('active');
    $('#gameOverOverlay').classList.remove('active');
    $('#hudHigh').textContent = padScore(getHighScore());
    const canvas = $('#gameCanvas');
    const players = playersFromServer.map((p) => ({
      id: p.id, name: p.name, isBot: p.isBot, isLocal: p.id === socket.id, color: p.color || 'gray',
    }));
    activeGame = new Game(canvas, {
      mode: 'multi',
      seed,
      players,
      onScoreTick: (score) => { $('#hudScore').textContent = padScore(score); },
      onLocalDeath: () => {},
      onAllDone: () => {},
    });

    runCountdown(() => {
      activeGame.start();
      let lastDead = false;
      updateInterval = setInterval(() => {
        if (!activeGame) return;
        const p = activeGame.local;
        socket.emit('game:update', { distance: p.distance, alive: p.alive });
        if (p.alive) { setHighScore(Math.floor(p.distance / 10)); }
        if (!p.alive && !lastDead) { lastDead = true; $('#waitingOverlay').classList.add('active'); }
      }, 150);
    });
  }

  function showMultiResults(results) {
    stopUpdateLoop();
    $('#waitingOverlay').classList.remove('active');
    const medals = ['1', '2', '3'];
    $('#resultsList').innerHTML = results.map((r, i) => `
      <div class="result-item ${i === 0 ? 'first' : ''}">
        <div class="result-rank">${medals[i] || (i + 1)}</div>
        <div style="flex:1;padding:0 10px;">${r.isBot ? '[bot] ' : ''}${escapeHtml(r.name)}${r.id === socket.id ? ' (voce)' : ''}</div>
        <div><b>${padScore(Math.floor((r.score || 0) / 10))}</b></div>
      </div>`).join('');
    $('#btnPlayAgain').onclick = () => { showScreen('screen-lobby'); renderLobby(); };
    showScreen('screen-results');
  }

  function goHome() {
    $('#gameOverOverlay').classList.remove('active');
    $('#waitingOverlay').classList.remove('active');
    if (socket && currentRoom) socket.emit('room:leave');
    currentRoom = null;
    if (activeGame) { activeGame.destroy(); activeGame = null; }
    showScreen('screen-home');
    $('#homeHighscore').textContent = getHighScore() > 0 ? `recorde ${padScore(getHighScore())}` : '';
    paintBrand();
    renderHomeColors();
  }

  $('#btnBackHome').addEventListener('click', goHome);
  $('#btnGameOverMenu').addEventListener('click', goHome);

  function runCountdown(done) {
    const el = $('#countdown');
    let n = 3;
    el.textContent = n;
    Sound.countdown();
    const t = setInterval(() => {
      n--;
      if (n > 0) { el.textContent = n; Sound.countdown(); }
      else if (n === 0) { el.textContent = 'VAI!'; Sound.go(); }
      else { clearInterval(t); el.textContent = ''; done(); }
    }, 700);
  }

  $('#touchJump').addEventListener('touchstart', (e) => { e.preventDefault(); activeGame?.handleInput('jump'); });
  $('#touchDown').addEventListener('touchstart', (e) => { e.preventDefault(); activeGame?.handleInput('duckdown'); });
  $('#touchDown').addEventListener('touchend', (e) => { e.preventDefault(); activeGame?.handleInput('duckup'); });
  const canvasEl = $('#gameCanvas');
  canvasEl.addEventListener('touchstart', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const y = e.touches[0].clientY - rect.top;
    if (y < rect.height / 2) activeGame?.handleInput('jump');
    else activeGame?.handleInput('duckdown');
  });
  canvasEl.addEventListener('touchend', () => activeGame?.handleInput('duckup'));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
