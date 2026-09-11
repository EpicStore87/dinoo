// ===== Constantes de fisica =====
const GRAVITY = 2600;
const JUMP_SPEED = 760;
const DINO_X = 78;
const DINO_W = 44, DINO_H = 47;
const DINO_DUCK_W = 59, DUCK_H = 18;
const DUCK_LEFT = 18;
const GROUND_MARGIN = 18;
const BIRD_W = 42, BIRD_H = 30;
const BIRD_FROM_GROUND = 26;

// Raio real da moeda para colisão
const COIN_RADIUS = 10;
const COIN_PICKUP_VALUE = 15;
const COIN_PER_100M = 5;

function adminSpeedScale() {
  const s = window.DINO_ADMIN && Number(window.DINO_ADMIN.speedScale);
  return Number.isFinite(s) && s > 0 ? Math.max(0.5, Math.min(3, s)) : 1;
}
function adminImmortal() {
  return !!(window.DINO_ADMIN && window.DINO_ADMIN.immortal);
}
function speedAt(elapsedMs) {
  const t = elapsedMs / 1000;
  return (340 + Math.min(t * 36, 360)) * adminSpeedScale();
}

function hexToRgb(hex) {
  const h = String(hex || '#535353').replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ===== Catalogo da loja (imagens reais em /img/shop) =====
const ACCESSORIES = [
  { id: 'none',    name: 'Nenhum',         cost: 0,   img: '/img/shop/acc-none.png',    rarity: 'comum' },
  { id: 'straw',   name: 'Chapeu de Palha',cost: 80,  img: '/img/shop/acc-straw.png',   rarity: 'comum' },
  { id: 'cap',     name: 'Bone',           cost: 90,  img: '/img/shop/acc-cap.png',     rarity: 'comum' },
  { id: 'bow',     name: 'Laco',           cost: 60,  img: '/img/shop/acc-bow.png',     rarity: 'comum' },
  { id: 'flower',  name: 'Florzinha',      cost: 70,  img: '/img/shop/acc-flower.png',  rarity: 'comum' },
  { id: 'glasses', name: 'Oculos',         cost: 120, img: '/img/shop/acc-glasses.png', rarity: 'comum' },
  { id: 'pirate',  name: 'Bandana Pirata', cost: 180, img: '/img/shop/acc-pirate.png',  rarity: 'raro' },
  { id: 'santa',   name: 'Gorro de Natal', cost: 220, img: '/img/shop/acc-santa.png',   rarity: 'raro' },
  { id: 'crown',   name: 'Coroa',          cost: 200, img: '/img/shop/acc-crown.png',   rarity: 'raro' },
  { id: 'viking',  name: 'Elmo Viking',    cost: 280, img: '/img/shop/acc-viking.png',  rarity: 'épico' },
  { id: 'ninja',   name: 'Faixa Ninja',    cost: 350, img: '/img/shop/acc-ninja.png',   rarity: 'épico' },
];

const SKINS = [
  { id: 'classic',  name: 'Classico', cost: 0,   img: '/img/shop/skin-classic.png',  rarity: 'comum' },
  { id: 'godzilla', name: 'Godzilla', cost: 400, img: '/img/shop/skin-godzilla.png', rarity: 'épico' },
  { id: 'gold',     name: 'Dourado',  cost: 300, img: '/img/shop/skin-gold.png',     rarity: 'raro' },
  { id: 'ghost',    name: 'Fantasma', cost: 250, img: '/img/shop/skin-ghost.png',    rarity: 'raro' },
];

const SCENES = [
  { id: 'desert', name: 'Deserto', cost: 0,   img: '/img/shop/scene-desert.png', rarity: 'comum', bg: '#f2f2f2', ground: '#e4d6b0', line: '#535353', night: false, flyer: 'pterodactyl' },
  { id: 'forest', name: 'Floresta',cost: 150, img: '/img/shop/scene-forest.png', rarity: 'comum', bg: '#78bae6', ground: '#4f9a3c', line: '#2f6a24', night: false, flyer: 'seagull' },
  { id: 'snow',   name: 'Neve',    cost: 180, img: '/img/shop/scene-snow.png',   rarity: 'raro',  bg: '#b9d6ee', ground: '#f3f7fb', line: '#7d93a6', night: false, flyer: 'seagull' },
  { id: 'night',  name: 'Noite',   cost: 220, img: '/img/shop/scene-night.png',  rarity: 'raro',  bg: '#2a3144', ground: '#1a2030', line: '#d5dbe8', night: true,  flyer: 'pterodactyl' },
];

const RARITY_COLORS = {
  'comum':    '#888',
  'raro':     '#3d5f99',
  'épico':    '#6b4a8c',
  'lendário': '#c46b28',
};

// Pool de roleta: peso por raridade
const ROULETTE_POOL = [];
ACCESSORIES.filter(a => a.id !== 'none').forEach(a => {
  const w = a.rarity === 'comum' ? 6 : a.rarity === 'raro' ? 3 : a.rarity === 'épico' ? 2 : 1;
  for (let i = 0; i < w; i++) ROULETTE_POOL.push(a.id);
});

const ROULETTE_COST = 50;

// Acessório equipado (salvo no localStorage)
function getEquippedAccessory() {
  return localStorage.getItem('dino_accessory') || 'none';
}
function setEquippedAccessory(id) {
  localStorage.setItem('dino_accessory', id);
}
function getOwnedAccessories() {
  try { return JSON.parse(localStorage.getItem('dino_owned_accessories') || '["none"]'); }
  catch { return ['none']; }
}
function addOwnedAccessory(id) {
  const owned = getOwnedAccessories();
  if (!owned.includes(id)) { owned.push(id); localStorage.setItem('dino_owned_accessories', JSON.stringify(owned)); }
}
function getEquippedSkin() { return localStorage.getItem('dino_skin') || 'classic'; }
function setEquippedSkin(id) { localStorage.setItem('dino_skin', id); }
function getOwnedSkins() {
  try { return JSON.parse(localStorage.getItem('dino_owned_skins') || '["classic"]'); }
  catch { return ['classic']; }
}
function addOwnedSkin(id) {
  const owned = getOwnedSkins();
  if (!owned.includes(id)) { owned.push(id); localStorage.setItem('dino_owned_skins', JSON.stringify(owned)); }
}
function getEquippedScene() { return localStorage.getItem('dino_scene') || 'desert'; }
function setEquippedScene(id) { localStorage.setItem('dino_scene', id); }
function getOwnedScenes() {
  try { return JSON.parse(localStorage.getItem('dino_owned_scenes') || '["desert"]'); }
  catch { return ['desert']; }
}
function addOwnedScene(id) {
  const owned = getOwnedScenes();
  if (!owned.includes(id)) { owned.push(id); localStorage.setItem('dino_owned_scenes', JSON.stringify(owned)); }
}
function currentScene() {
  return sceneById(getEquippedScene());
}
function sceneById(id) {
  return SCENES.find((s) => s.id === id) || SCENES[0];
}

// ===== Arte do Dino =====
const DinoArt = (() => {
  const stand = new Image(); stand.src = '/img/dino.png';
  const duck  = new Image(); duck.src  = '/img/dino-duck.png';
  const godzilla = new Image(); godzilla.src = '/img/godzilla.png';
  const tintCache = new Map();
  const listeners = [];
  function bake() { tintCache.clear(); listeners.forEach(fn => fn()); }
  stand.onload = bake; duck.onload = bake;
  function ready() { return stand.complete && stand.naturalWidth > 0; }
  function onReady(fn) { if (ready()) fn(); else listeners.push(fn); }

  function tintImage(src, hex) {
    if (!src.complete || src.naturalWidth === 0) return null;
    const key = hex + '|' + src.src;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = document.createElement('canvas');
    c.width = src.naturalWidth; c.height = src.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const [tr, tg, tb] = hexToRgb(hex);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i+3] < 20) continue;
      const bright = (px[i]+px[i+1]+px[i+2])/3;
      if (bright > 225) { px[i+3] = 0; continue; }
      const shade = Math.max(0.28, Math.min(1, bright/90));
      px[i]   = Math.round(tr*shade);
      px[i+1] = Math.round(tg*shade);
      px[i+2] = Math.round(tb*shade);
    }
    ctx.putImageData(data, 0, 0);
    tintCache.set(key, c);
    return c;
  }

  function draw(ctx, x, groundY, yOffset, ducking, dead, shielded, colorHex, accessoryId, skinId) {
    let hex = dead ? '#9a3b32' : (colorHex || '#535353');
    skinId = skinId || ((typeof getEquippedSkin === 'function') ? getEquippedSkin() : 'classic');
    if (!dead && skinId === 'gold') hex = '#c46b28';
    if (!dead && skinId === 'ghost') hex = '#8a96a4';
    if (!dead && skinId === 'godzilla') hex = '#3d7a4a';
    const useGodzilla = !ducking && skinId === 'godzilla' && godzilla.complete && godzilla.naturalWidth > 0;
    const bodyH = useGodzilla ? 42 : (ducking ? DUCK_H : DINO_H);
    const drawW = useGodzilla ? 62 : (ducking ? DINO_DUCK_W : DINO_W);
    const src = ducking ? duck : stand;
    const sprite = useGodzilla ? godzilla : tintImage(src, hex);
    const baseY = groundY - yOffset;
    const top = baseY - bodyH;
    const left = ducking ? x - DUCK_LEFT : x - drawW/2;

    ctx.save();
    if (shielded) { ctx.shadowColor='#2e7d70'; ctx.shadowBlur=10; }
    if (skinId === 'ghost' && !dead) ctx.globalAlpha = 0.72;
    ctx.imageSmoothingEnabled = false;
    if (sprite) ctx.drawImage(sprite, left, top, drawW, bodyH);
    else { ctx.fillStyle = hex; ctx.fillRect(left, top, drawW, bodyH); }

    if (!dead && accessoryId && accessoryId !== 'none') {
      AccArt.drawOnDino(ctx, accessoryId, left, top, drawW, bodyH, ducking, skinId);
    }
    ctx.restore();
  }

  return { draw, onReady, ready, tintImage };
})();

const AccArt = (() => {
  const cache = new Map();
  // ox/oy relativos ao canto do sprite do dino (em pe 44x47)
  const POSE = {
    glasses: { ox: 18, oy: 6,  w: 22, h: 12 },
    cap:     { ox: 14, oy: -8, w: 26, h: 16 },
    straw:   { ox: 12, oy: -10,w: 28, h: 16 },
    santa:   { ox: 14, oy: -14,w: 24, h: 20 },
    crown:   { ox: 16, oy: -10,w: 22, h: 14 },
    flower:  { ox: 26, oy: -2, w: 14, h: 14 },
    bow:     { ox: 4,  oy: 2,  w: 16, h: 14 },
    ninja:   { ox: 16, oy: 6,  w: 24, h: 12 },
    pirate:  { ox: 14, oy: -6, w: 24, h: 14 },
    viking:  { ox: 12, oy: -12,w: 28, h: 18 },
  };
  function img(src) {
    if (cache.has(src)) return cache.get(src);
    const i = new Image();
    i.src = src;
    cache.set(src, i);
    return i;
  }
  function drawOnDino(ctx, id, left, top, drawW, drawH, ducking, skinId) {
    const acc = ACCESSORIES.find((a) => a.id === id);
    if (!acc || !acc.img) return;
    const im = img(acc.img);
    if (!im.complete || !im.naturalWidth) return;
    const p = POSE[id] || { ox: 12, oy: -8, w: 20, h: 16 };
    const sx = drawW / DINO_W;
    const sy = drawH / DINO_H;
    let ox = p.ox * sx;
    let oy = p.oy * sy;
    if (skinId === 'godzilla') {
      ox += drawW * 0.18;
      oy += drawH * 0.06;
    }
    if (ducking) {
      ox += 10 * sx;
      oy += 6 * sy;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, left + ox, top + oy, p.w * sx, p.h * sy);
  }
  return { drawOnDino };
})();

const BirdArt = (() => {
  const ptero = new Image(); ptero.src = '/img/bird.png';
  const gull = new Image(); gull.src = '/img/seagull.png';
  function pick(scene) {
    return scene && scene.flyer === 'seagull' ? gull : ptero;
  }
  function draw(ctx, x, groundY, night, scene) {
    const img = pick(scene);
    const top = groundY - BIRD_FROM_GROUND - BIRD_H;
    const left = x - BIRD_W/2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (img.complete && img.naturalWidth) {
      if (night) ctx.filter = 'brightness(1.25)';
      ctx.drawImage(img, left, top, BIRD_W + 8, BIRD_H + 4);
    } else {
      ctx.fillStyle = night ? '#9fb0c9' : '#535353';
      ctx.fillRect(left+8, top+10, 24, 10);
    }
    ctx.restore();
  }
  return { draw };
})();

const CloudArt = (() => {
  const img = new Image(); img.src = '/img/cloud.png';
  function draw(ctx, x, y, night) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (img.complete && img.naturalWidth) {
      ctx.globalAlpha = night ? 0.35 : 0.9;
      ctx.drawImage(img, x, y, 46, 13);
    } else {
      ctx.fillStyle = night ? '#6b7385' : '#d0d0d0';
      ctx.fillRect(x+8, y+6, 28, 6);
    }
    ctx.restore();
  }
  return { draw };
})();

const CactusArt = (() => {
  const files = ['/img/cactus-a.png', '/img/cactus-b.png', '/img/cactus-c.png'];
  const imgs = files.map(src => { const im = new Image(); im.src = src; return im; });
  function ready(i) { const im = imgs[i]; return im && im.complete && im.naturalWidth > 0; }
  function draw(ctx, kind, x, groundY, w, h, night) {
    const top = groundY - h;
    const left = x - w/2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (night) ctx.filter = 'brightness(1.35)';
    if (ready(kind)) ctx.drawImage(imgs[kind], left, top, w, h);
    else { ctx.fillStyle = night ? '#9fb0c9' : '#535353'; ctx.fillRect(left+w*0.35, top, w*0.3, h); }
    ctx.restore();
  }
  return { draw };
})();

const TreeArt = (() => {
  const files = ['/img/tree-a.png', '/img/tree-b.png', '/img/tree-c.png'];
  const imgs = files.map((src) => { const im = new Image(); im.src = src; return im; });
  function ready(i) { const im = imgs[i % imgs.length]; return im && im.complete && im.naturalWidth > 0; }
  function draw(ctx, kind, x, groundY, w, h) {
    const i = ((kind % 3) + 3) % 3;
    const top = groundY - h;
    const left = x - w / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (ready(i)) ctx.drawImage(imgs[i], left, top, w, h);
    else {
      ctx.fillStyle = '#3d8c3a';
      ctx.beginPath();
      ctx.ellipse(x, groundY - h * 0.55, w * 0.45, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a4e24';
      ctx.fillRect(x - 3, groundY - h * 0.35, 6, h * 0.35);
    }
    ctx.restore();
  }
  return { draw };
})();

class ObstacleTrack {
  constructor(seed) { this.seed = seed; this.cum = [typeof TRACK_START === 'number' ? TRACK_START : 560]; }
  ensureCoverage(targetDistance) {
    let guard = 0;
    while (this.cum[this.cum.length-1] < targetDistance+1200 && guard < 5000) {
      const o = obstacleAt(this.seed, this.cum.length-1);
      this.cum.push(this.cum[this.cum.length-1] + o.gap);
      guard++;
    }
  }
  get(index) {
    const o = obstacleAt(this.seed, index);
    return Object.assign({}, o, { absDistance: this.cum[index] });
  }
  visibleIn(minD, maxD) {
    this.ensureCoverage(maxD);
    let lo = 0, hi = this.cum.length-1;
    const target = minD - 140;
    while (lo < hi) { const mid=(lo+hi)>>1; if(this.cum[mid]<target) lo=mid+1; else hi=mid; }
    const res = [];
    let i = lo;
    while (i < this.cum.length-1 && this.cum[i] <= maxD) { res.push(this.get(i)); i++; }
    return res;
  }
  nextIndexNear(distance) {
    this.ensureCoverage(distance+200);
    let lo=0, hi=this.cum.length-1;
    while(lo<hi){ const mid=(lo+hi)>>1; if(this.cum[mid]<distance) lo=mid+1; else hi=mid; }
    return Math.max(0, lo-1);
  }
}

// Partículas de coleta de moeda
class CoinParticle {
  constructor(x, y) { this.x=x; this.y=y; this.vy=-80; this.life=1.0; this.text='+'+COIN_PICKUP_VALUE; }
  update(dt) { this.y+=this.vy*dt; this.life-=dt*1.8; }
  dead() { return this.life<=0; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = '#2e7d70';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class Game {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = opts.mode;
    this.seed = opts.seed;
    this.track = new ObstacleTrack(this.seed);
    this.onLocalDeath  = opts.onLocalDeath  || (() => {});
    this.onScoreTick   = opts.onScoreTick   || (() => {});
    this.onAllDone     = opts.onAllDone     || (() => {});
    this.onCoinsEarned = opts.onCoinsEarned || (() => {});
    this.coinsThisRun = 0;
    this.lastCoinMilestone = 0;
    this.highScore = opts.highScore || 0;
    this.particles = [];

    this.players = opts.players.map(p => ({
      ...p,
      color: p.color || 'gray',
      distance: 0,
      displayDistance: 0,
      alive: true,
      collected: new Set(),
      accessory: p.accessory || (p.isLocal ? getEquippedAccessory() : 'none'),
      skin: p.skin || (p.isLocal ? getEquippedSkin() : 'classic'),
      scene: p.scene || (p.isLocal ? getEquippedScene() : 'desert'),
    }));
    this.local = this.players.find(p => p.isLocal);
    this.local.phys = { y: 0, vy: 0, jumping: false, ducking: false };
    this.startTime = null;
    this.running = false;
    this.paused = false;
    this.onPauseChange = opts.onPauseChange || (() => {});
    this.raf = null;
    this.dayNight = 0;
    this.lastMilestone = 0;

    this._resizeHandler = this._resize.bind(this);
    this._resize();
    window.addEventListener('resize', this._resizeHandler);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
    DinoArt.onReady(() => { if (this.running || this.canvas) this._render(); });
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    const cssWidth = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    this.laneHeight = this.mode === 'solo' ? 220 : Math.max(90, Math.min(150, 420/this.players?.length||140));
    const cssHeight = this.laneHeight * (this.players?this.players.length:1);
    this.canvas.style.height = cssHeight+'px';
    this.canvas.width  = Math.floor(cssWidth*dpr);
    this.canvas.height = Math.floor(cssHeight*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.width  = cssWidth;
    this.height = cssHeight;
  }

  handleInput(action) {
    if (!this.local.alive) return;
    const phys = this.local.phys;
    if (action === 'jump') {
      if (!phys.jumping) { phys.jumping=true; phys.vy=JUMP_SPEED; phys.ducking=false; Sound.jump(); }
    } else if (action === 'duckdown') {
      if (!phys.jumping) { phys.ducking=true; Sound.duck(); }
    } else if (action === 'duckup') {
      phys.ducking = false;
    }
  }

  _onKeyDown(e) {
    if (e.repeat) return;
    if ((e.code==='KeyP' || e.code==='Escape') && this.mode === 'solo') {
      e.preventDefault();
      this.togglePause();
      return;
    }
    if (this.paused) return;
    if (e.code==='Space'||e.code==='ArrowUp') { e.preventDefault(); this.handleInput('jump'); }
    else if (e.code==='ArrowDown') { e.preventDefault(); this.handleInput('duckdown'); }
  }
  _onKeyUp(e) { if (e.code==='ArrowDown') this.handleInput('duckup'); }

  start() {
    this.running = true;
    this.paused = false;
    this.startTime = performance.now();
    this.raf = requestAnimationFrame(this._loop.bind(this));
  }

  togglePause() {
    if (this.mode !== 'solo' || !this.running) return false;
    this.paused = !this.paused;
    if (!this.paused) this._last = performance.now();
    if (typeof this.onPauseChange === 'function') this.onPauseChange(this.paused);
    return this.paused;
  }

  destroy() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    window.removeEventListener('resize',  this._resizeHandler);
  }

  updateRemote(playersState) {
    for (const s of playersState) {
      const p = this.players.find(pp => pp.id === s.id);
      if (!p || p.isLocal) continue;
      p.distance = s.distance;
      if (s.color) p.color = s.color;
      if (s.accessory) p.accessory = s.accessory;
      if (s.skin) p.skin = s.skin;
      if (s.scene) p.scene = s.scene;
      if (p.alive && !s.alive) p.alive = false;
    }
  }

  _loop(now) {
    if (!this.running) return;
    if (this.paused) {
      this.startTime += now - (this._last || now);
      this._last = now;
      this._render();
      this.raf = requestAnimationFrame(this._loop.bind(this));
      return;
    }
    const dt = Math.min((now-(this._last||now))/1000, 0.05);
    this._last = now;
    const elapsed = now - this.startTime;
    const spd = speedAt(elapsed);

    if (this.local.alive) {
      this.local.distance += spd*dt;
      const phys = this.local.phys;
      if (phys.jumping) {
        phys.vy -= GRAVITY*dt;
        phys.y  += phys.vy*dt;
        if (phys.y <= 0) { phys.y=0; phys.vy=0; phys.jumping=false; }
      }
      this._checkLocalCollisions(elapsed);
      const score = Math.floor(this.local.distance/10);
      this.onScoreTick(score);
      if (score > 0 && Math.floor(score/100) > this.lastCoinMilestone) {
        this.lastCoinMilestone = Math.floor(score/100);
        this.coinsThisRun += COIN_PER_100M;
        this.onCoinsEarned(COIN_PER_100M, this.coinsThisRun);
      }
      if (score > 0 && Math.floor(score/500) > this.lastMilestone) {
        this.lastMilestone = Math.floor(score/500); Sound.point();
      }
      this.dayNight = Math.floor(score/700) % 2;
    }
    this.local.displayDistance = this.local.distance;

    for (const p of this.players) {
      if (p.isLocal) continue;
      const target = p.distance;
      p.displayDistance += (target - p.displayDistance)*Math.min(1,dt*8);
    }

    // Atualizar partículas
    this.particles = this.particles.filter(pt => { pt.update(dt); return !pt.dead(); });

    this._render();

    const allDone = this.players.every(p => !p.alive);
    if (this.mode==='solo' && !this.local.alive) {
      this.running=false; this.onLocalDeath(Math.floor(this.local.distance/10)); return;
    }
    if (this.mode==='multi' && allDone) {
      this.running=false; this.onAllDone(); return;
    }
    this.raf = requestAnimationFrame(this._loop.bind(this));
  }

  _dinoDrawLeft(p) {
    const ducking = !!(p.phys && p.phys.ducking);
    return ducking ? (p.distance - DUCK_LEFT) : (p.distance - DINO_W/2);
  }

  _dinoHitboxes(p) {
    const ducking = !!(p.phys && p.phys.ducking);
    const yOff = (p.phys && p.phys.y) || 0;
    const left = this._dinoDrawLeft(p);
    if (ducking) {
      return [{ x: left+16, y: yOff+1, w: 28, h: 15, visualRight: left+50 }];
    }
    return [{ x: left+14, y: yOff+4, w: 18, h: 36, visualRight: left+DINO_W-1 }];
  }

  _obsHitboxes(o) {
    if (o.type === 'bird') {
      return [{ x: o.absDistance-6, y: BIRD_FROM_GROUND+8, w: 14, h: 12, visualLeft: o.absDistance-BIRD_W/2+6 }];
    }
    const parts = (o.parts&&o.parts.length) ? o.parts : [{dx:0,w:o.width||24,h:o.height||40}];
    return parts.map(part => {
      const w = part.w||30, h = part.h||44;
      return { x: o.absDistance+part.dx-5, y: 0, w: 10, h: h-6, visualLeft: o.absDistance+part.dx-w/2+3 };
    });
  }

  _overlap(a, b) {
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  _snapToTouch(p, hitBox) {
    const dinoBox = this._dinoHitboxes(p)[0];
    const gap = hitBox.visualLeft - dinoBox.visualRight + 2;
    if (Math.abs(gap) < 160) { p.distance += gap; p.displayDistance = p.distance; }
  }

  _checkLocalCollisions(elapsed) {
    const p = this.local;
    if (!p.alive) return;
    if (p.distance < 80) return;
    const dinoWorldX = p.distance;
    const dinoBoxes  = this._dinoHitboxes(p);
    const phys = p.phys;
    const obs = this.track.visibleIn(dinoWorldX-120, dinoWorldX+120);

    for (const o of obs) {
      // ===== COLETA DE MOEDA: hitbox circular correta =====
      if (o.hasCoin && !p.collected.has(o.index)) {
        const coinWorldX = o.absDistance - 90;
        const coinWorldY = 60;
        const r = COIN_RADIUS + 4;
        const hitsCoin = dinoBoxes.some((db) => {
          const nx = Math.max(db.x, Math.min(coinWorldX, db.x + db.w));
          const ny = Math.max(db.y, Math.min(coinWorldY, db.y + db.h));
          const dx = coinWorldX - nx;
          const dy = coinWorldY - ny;
          return dx * dx + dy * dy <= r * r;
        });
        if (hitsCoin) {
          p.collected.add(o.index);
          this.coinsThisRun = (this.coinsThisRun||0) + COIN_PICKUP_VALUE;
          this.onCoinsEarned(COIN_PICKUP_VALUE, this.coinsThisRun);
          // Partícula visual na posição da moeda na tela
          const screenX = DINO_X + (coinWorldX - dinoWorldX);
          const groundY = this.laneHeight - GROUND_MARGIN;
          this.particles.push(new CoinParticle(screenX, groundY - 60));
          Sound.shield();
        }
      }

      // ===== COLISÃO COM OBSTÁCULO =====
      const boxes = this._obsHitboxes(o);
      let hitBox = null;
      for (const ob of boxes) {
        if (dinoBoxes.some(db => this._overlap(db, ob))) { hitBox=ob; break; }
      }
      if (hitBox) {
        if (adminImmortal()) continue;
        this._snapToTouch(p, hitBox);
        p.alive = false;
        Sound.hit();
      }
    }
  }

  _render() {
    const ctx = this.ctx;
    const w = this.width, h = this.height;
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(0, 0, w, h);
    const night = this.dayNight === 1;

    this.players.forEach((p, i) => {
      const laneY = i * this.laneHeight;
      this._renderLane(p, laneY, this.laneHeight, night ? '#e7ebf5' : '#535353', night, p.isLocal);
    });

    // Partículas no topo
    for (const pt of this.particles) pt.draw(ctx);
  }

  _colorHex(p) {
    if (typeof colorById === 'function') return colorById(p.color).hex;
    return '#535353';
  }

  _renderLane(p, laneTop, laneH, fg, night, isLocal) {
    const ctx = this.ctx;
    const groundY = laneTop + laneH - GROUND_MARGIN;
    const dist = p.displayDistance;
    const hex  = this._colorHex(p);
    const accId = p.accessory || (isLocal && typeof getEquippedAccessory === 'function' ? getEquippedAccessory() : 'none');
    const skinId = p.skin || (isLocal && typeof getEquippedSkin === 'function' ? getEquippedSkin() : 'classic');
    const scene = sceneById(p.scene || (isLocal && typeof getEquippedScene === 'function' ? getEquippedScene() : 'desert'));
    const nightLane = !!(scene.night || night);

    ctx.fillStyle = nightLane ? '#1a2336' : (scene.bg || '#f2f2f2');
    ctx.fillRect(0, laneTop, this.width, laneH);

    ctx.strokeStyle = nightLane ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.moveTo(0,laneTop); ctx.lineTo(this.width,laneTop); ctx.stroke();

    this._drawSky(laneTop, laneH, groundY, dist, nightLane, scene);

    ctx.font = '700 12px Courier New, monospace';
    ctx.fillStyle = p.alive ? hex : '#9a3b32';
    const label = `${p.isBot?'[bot] ':''}${p.name}${isLocal?' (voce)':''}${!p.alive?' X':''}`;
    ctx.fillText(label, 8, laneTop+16);
    if (!p.isLocal) {
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.floor(p.displayDistance/10)).padStart(5,'0'), this.width-8, laneTop+16);
      ctx.textAlign = 'left';
    }

    // Chao tematico
    ctx.fillStyle = scene.ground || '#e4d6b0';
    ctx.fillRect(0, groundY, this.width, laneTop + laneH - groundY + 2);
    ctx.strokeStyle = scene.line || fg;
    ctx.globalAlpha = 0.95; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,groundY); ctx.lineTo(this.width,groundY); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = scene.line || fg;
    for (let gx=-20; gx<this.width+40; gx+=12) {
      const world = dist+gx;
      const n = Math.abs(Math.sin(world*0.17)*Math.sin(world*0.05));
      if (scene.id === 'forest') {
        if (n>0.55) ctx.fillRect(gx, groundY-3-((world|0)%4), 2, 3+((world|0)%4));
      } else {
        if (n>0.72) { const bh=2+((world|0)%3); ctx.fillRect(gx,groundY-bh,6+((world|0)%5),bh); }
      }
      if (((world*13)|0)%7===0) { ctx.fillRect(gx,groundY+3+((world|0)%4),2,2); }
    }

    // Obstáculos e moedas
    const obs = this.track.visibleIn(dist-60, dist+this.width+60);
    for (const o of obs) {
      const x = DINO_X + (o.absDistance - dist);
      if (x < -80 || x > this.width+80) continue;
      if (o.hasCoin && !p.collected.has(o.index)) {
        this._drawCoin(x-90, groundY-60, nightLane);
      }
      this._drawObstacle(o, x, groundY, nightLane, scene);
    }

    // Dino
    let poseY=0, ducking=false, dead=!p.alive;
    if (isLocal) { poseY=p.phys.y; ducking=p.phys.ducking; }
    else {
      const idx = this.track.nextIndexNear(dist+DINO_X);
      const next = this.track.get(idx);
      const distTo = next.absDistance-(dist+DINO_X);
      if (p.alive && distTo<70 && distTo>-30) {
        if (next.duckRequired) ducking=true;
        else poseY=Math.max(0,46*Math.sin(Math.PI*Math.min(1,Math.max(0,(70-distTo)/90))));
      }
    }
    DinoArt.draw(ctx, DINO_X, groundY, poseY, ducking, dead, false, hex, accId, skinId);
  }

  _drawSky(laneTop, laneH, groundY, dist, night, scene) {
    const ctx = this.ctx;
    const w = this.width;
    if (night || scene.night) {
      ctx.fillStyle = '#f6f0c4';
      ctx.beginPath();
      ctx.arc(w - 64, laneTop + 26, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a2336';
      ctx.beginPath();
      ctx.arc(w - 57, laneTop + 22, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      const skyH = Math.max(24, groundY - laneTop - 28);
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 53 + 11 - dist * 0.04) % (w + 10) + (w + 10)) % (w + 10);
        const sy = laneTop + 6 + ((i * 29) % skyH);
        ctx.globalAlpha = 0.45 + (i % 4) * 0.18;
        const s = (i % 5 === 0) ? 2 : 1;
        ctx.fillRect(sx, sy, s, s);
      }
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = '#ffd056';
    ctx.beginPath();
    ctx.arc(w - 56, laneTop + 26, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,208,86,0.35)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 8; r++) {
      const a = r * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(w - 56 + Math.cos(a) * 20, laneTop + 26 + Math.sin(a) * 20);
      ctx.lineTo(w - 56 + Math.cos(a) * 28, laneTop + 26 + Math.sin(a) * 28);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const span = w + 90;
      const cx = ((i * 130 + 40 - dist * 0.45) % span + span) % span - 50;
      const cy = laneTop + 12 + (i % 4) * 11;
      CloudArt.draw(ctx, cx, cy, false);
    }
  }

  _drawObstacle(o, x, groundY, night, scene) {
    scene = scene || currentScene();
    if (o.type === 'bird') { BirdArt.draw(this.ctx, x, groundY, night, scene); return; }
    const forest = scene && scene.id === 'forest';
    const parts = (o.parts&&o.parts.length)?o.parts:[{kind:o.type==='cactus_big'?1:0,dx:0,w:o.width||30,h:o.height||44}];
    for (const part of parts) {
      if (forest) {
        const th = Math.max(part.h, part.kind === 1 ? 64 : 48);
        TreeArt.draw(this.ctx, part.kind, x+part.dx, groundY, part.w + 4, th);
      } else {
        CactusArt.draw(this.ctx, part.kind, x+part.dx, groundY, part.w, part.h, night);
      }
    }
  }

  _drawCoin(x, y, night) {
    const ctx = this.ctx;
    const t = performance.now()/200;
    ctx.save();
    ctx.translate(x, y + Math.sin(t)*4);
    // Sombra para profundidade
    ctx.shadowColor = night ? '#8fd4c4' : '#2e7d70';
    ctx.shadowBlur  = 6;
    // Corpo da moeda
    ctx.fillStyle = night ? '#8fd4c4' : '#2e7d70';
    ctx.beginPath();
    ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI*2);
    ctx.fill();
    // Brilho interno
    ctx.shadowBlur = 0;
    ctx.fillStyle = night ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.30)';
    ctx.beginPath();
    ctx.arc(-2, -2, COIN_RADIUS*0.45, 0, Math.PI*2);
    ctx.fill();
    // Símbolo $
    ctx.fillStyle = night ? '#2b3040' : '#f2f2f2';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
  }
}

function drawBrandDino(canvas, colorHex) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w=canvas.width, h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.imageSmoothingEnabled = false;
  DinoArt.draw(ctx, w/2, h-6, 0, false, false, false, colorHex||'#535353', getEquippedAccessory());
}
