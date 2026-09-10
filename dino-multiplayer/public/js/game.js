// ===== Constantes de fisica (mundo em "px", mesma escala pro score) =====
const GRAVITY = 2600;
const JUMP_SPEED = 760;
const DINO_X = 78;          // posicao fixa do dino na tela (em cada raia)
const DINO_W = 44, DINO_H = 47;
const DINO_DUCK_W = 59, DUCK_H = 18;
const DUCK_LEFT = 18; // DINO_X - isto = esquerda do sprite abaixado
const GROUND_MARGIN = 18;
const BIRD_W = 42, BIRD_H = 30;
const BIRD_FROM_GROUND = 26;

// Caixas no estilo do Chrome: relativas ao canto superior-esquerdo do sprite (y pra baixo no sprite).

function speedAt(elapsedMs) {
  const t = elapsedMs / 1000;
  return 300 + Math.min(t * 18, 260);
}

function hexToRgb(hex) {
  const h = String(hex || '#535353').replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const DinoArt = (() => {
  const stand = new Image();
  stand.src = '/img/dino.png';
  const duck = new Image();
  duck.src = '/img/dino-duck.png';
  const tintCache = new Map();
  const listeners = [];

  function bake() { tintCache.clear(); listeners.forEach((fn) => fn()); }
  stand.onload = bake;
  duck.onload = bake;

  function ready() {
    return stand.complete && stand.naturalWidth > 0;
  }
  function onReady(fn) {
    if (ready()) fn();
    else listeners.push(fn);
  }

  function tintImage(src, hex) {
    if (!src.complete || src.naturalWidth === 0) return null;
    const key = hex + '|' + src.src;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = document.createElement('canvas');
    c.width = src.naturalWidth;
    c.height = src.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const [tr, tg, tb] = hexToRgb(hex);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 20) continue;
      const bright = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (bright > 225) { px[i + 3] = 0; continue; }
      const shade = Math.max(0.28, Math.min(1, bright / 90));
      px[i] = Math.round(tr * shade);
      px[i + 1] = Math.round(tg * shade);
      px[i + 2] = Math.round(tb * shade);
    }
    ctx.putImageData(data, 0, 0);
    tintCache.set(key, c);
    return c;
  }

  function draw(ctx, x, groundY, yOffset, ducking, dead, shielded, colorHex) {
    const hex = dead ? '#9a3b32' : (colorHex || '#535353');
    const src = ducking ? duck : stand;
    const sprite = tintImage(src, hex);
    const bodyH = ducking ? DUCK_H : DINO_H;
    const drawW = ducking ? DINO_DUCK_W : DINO_W;
    const baseY = groundY - yOffset;
    const top = baseY - bodyH;
    // abaixado: pernas ficam no mesmo lugar, cabeca vai pra frente
    const left = ducking ? x - DUCK_LEFT : x - drawW / 2;

    ctx.save();
    if (shielded) {
      ctx.shadowColor = '#2e7d70';
      ctx.shadowBlur = 10;
    }
    ctx.imageSmoothingEnabled = false;
    if (sprite) {
      ctx.drawImage(sprite, left, top, drawW, bodyH);
    } else {
      ctx.fillStyle = hex;
      ctx.fillRect(left, top, drawW, bodyH);
    }
    ctx.restore();
  }

  return { draw, onReady, ready };
})();

const BirdArt = (() => {
  const img = new Image();
  img.src = '/img/bird.png';
  function ready() { return img.complete && img.naturalWidth > 0; }
  function draw(ctx, x, groundY, night) {
    const top = groundY - BIRD_FROM_GROUND - BIRD_H;
    const left = x - BIRD_W / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (ready()) {
      if (night) ctx.filter = 'brightness(1.35)';
      ctx.drawImage(img, left, top, BIRD_W, BIRD_H);
    } else {
      ctx.fillStyle = night ? '#9fb0c9' : '#535353';
      ctx.fillRect(left + 8, top + 10, 24, 10);
    }
    ctx.restore();
  }
  return { draw };
})();

const CloudArt = (() => {
  const img = new Image();
  img.src = '/img/cloud.png';
  function draw(ctx, x, y, night) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (img.complete && img.naturalWidth) {
      ctx.globalAlpha = night ? 0.35 : 0.9;
      ctx.drawImage(img, x, y, 46, 13);
    } else {
      ctx.fillStyle = night ? '#6b7385' : '#d0d0d0';
      ctx.fillRect(x + 8, y + 6, 28, 6);
    }
    ctx.restore();
  }
  return { draw };
})();

const CactusArt = (() => {
  const files = ['/img/cactus-a.png', '/img/cactus-b.png', '/img/cactus-c.png'];
  const imgs = files.map((src) => {
    const im = new Image();
    im.src = src;
    return im;
  });
  function ready(i) {
    const im = imgs[i];
    return im && im.complete && im.naturalWidth > 0;
  }
  function draw(ctx, kind, x, groundY, w, h, night) {
    const top = groundY - h;
    const left = x - w / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (night) ctx.filter = 'brightness(1.35)';
    if (ready(kind)) {
      ctx.drawImage(imgs[kind], left, top, w, h);
    } else {
      ctx.fillStyle = night ? '#9fb0c9' : '#535353';
      ctx.fillRect(left + w * 0.35, top, w * 0.3, h);
    }
    ctx.restore();
  }
  return { draw };
})();


class ObstacleTrack {
  constructor(seed) { this.seed = seed; this.cum = [typeof TRACK_START === "number" ? TRACK_START : 560]; }
  ensureCoverage(targetDistance) {
    let guard = 0;
    while (this.cum[this.cum.length - 1] < targetDistance + 1200 && guard < 5000) {
      const i = this.cum.length - 1;
      const o = obstacleAt(this.seed, i);
      this.cum.push(this.cum[this.cum.length - 1] + o.gap);
      guard++;
    }
  }
  get(index) {
    const o = obstacleAt(this.seed, index);
    return Object.assign({}, o, { absDistance: this.cum[index] });
  }
  visibleIn(minD, maxD) {
    this.ensureCoverage(maxD);
    let lo = 0, hi = this.cum.length - 1;
    const target = minD - 140;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < target) lo = mid + 1; else hi = mid;
    }
    const res = [];
    let i = lo;
    while (i < this.cum.length - 1 && this.cum[i] <= maxD) { res.push(this.get(i)); i++; }
    return res;
  }
  nextIndexNear(distance) {
    this.ensureCoverage(distance + 200);
    let lo = 0, hi = this.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < distance) lo = mid + 1; else hi = mid;
    }
    return Math.max(0, lo - 1);
  }
}

class Game {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = opts.mode;
    this.seed = opts.seed;
    this.track = new ObstacleTrack(this.seed);
    this.onLocalDeath = opts.onLocalDeath || (() => {});
    this.onScoreTick = opts.onScoreTick || (() => {});
    this.onAllDone = opts.onAllDone || (() => {});
    this.highScore = opts.highScore || 0;

    this.players = opts.players.map((p) => ({
      ...p,
      color: p.color || 'gray',
      distance: 0,
      displayDistance: 0,
      alive: true,
      collected: new Set(),
    }));
    this.local = this.players.find((p) => p.isLocal);

    this.local.phys = { y: 0, vy: 0, jumping: false, ducking: false, shield: false };
    this.startTime = null;
    this.running = false;
    this.raf = null;
    this.dayNight = 0;
    this.lastMilestone = 0;

    this._resizeHandler = this._resize.bind(this);
    this._resize();
    window.addEventListener('resize', this._resizeHandler);

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    DinoArt.onReady(() => { if (this.running || this.canvas) this._render(); });
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    this.laneHeight = this.mode === 'solo' ? 220 : Math.max(90, Math.min(150, 420 / this.players?.length || 140));
    const cssHeight = this.laneHeight * (this.players ? this.players.length : 1);
    this.canvas.style.height = cssHeight + 'px';
    this.canvas.width = Math.floor(cssWidth * dpr);
    this.canvas.height = Math.floor(cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = cssWidth;
    this.height = cssHeight;
  }

  handleInput(action) {
    if (!this.local.alive) return;
    const phys = this.local.phys;
    if (action === 'jump') {
      if (!phys.jumping) {
        phys.jumping = true;
        phys.vy = JUMP_SPEED;
        phys.ducking = false;
        Sound.jump();
      }
    } else if (action === 'duckdown') {
      if (!phys.jumping) { phys.ducking = true; Sound.duck(); }
    } else if (action === 'duckup') {
      phys.ducking = false;
    }
  }

  _onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); this.handleInput('jump'); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); this.handleInput('duckdown'); }
  }
  _onKeyUp(e) {
    if (e.code === 'ArrowDown') this.handleInput('duckup');
  }

  start() {
    this.running = true;
    this.startTime = performance.now();
    this.raf = requestAnimationFrame(this._loop.bind(this));
  }

  destroy() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._resizeHandler);
  }

  updateRemote(playersState) {
    for (const s of playersState) {
      const p = this.players.find((pp) => pp.id === s.id);
      if (!p || p.isLocal) continue;
      p.distance = s.distance;
      if (s.color) p.color = s.color;
      if (p.alive && !s.alive) p.alive = false;
    }
  }

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - (this._last || now)) / 1000, 0.05);
    this._last = now;
    const elapsed = now - this.startTime;
    const spd = speedAt(elapsed);

    if (this.local.alive) {
      this.local.distance += spd * dt;
      const phys = this.local.phys;
      if (phys.jumping) {
        phys.vy -= GRAVITY * dt;
        phys.y += phys.vy * dt;
        if (phys.y <= 0) { phys.y = 0; phys.vy = 0; phys.jumping = false; }
      }
      this._checkLocalCollisions();
      const score = Math.floor(this.local.distance / 10);
      this.onScoreTick(score);
      if (score > 0 && Math.floor(score / 500) > this.lastMilestone) {
        this.lastMilestone = Math.floor(score / 500);
        Sound.point();
      }
      this.dayNight = Math.floor(score / 700) % 2;
    }
    this.local.displayDistance = this.local.distance;

    for (const p of this.players) {
      if (p.isLocal) continue;
      const target = p.distance;
      p.displayDistance += (target - p.displayDistance) * Math.min(1, dt * 8);
    }

    this._render();

    const allDone = this.players.every((p) => !p.alive);
    if (this.mode === 'solo' && !this.local.alive) {
      this.running = false;
      this.onLocalDeath(Math.floor(this.local.distance / 10));
      return;
    }
    if (this.mode === 'multi' && allDone) {
      this.running = false;
      this.onAllDone();
      return;
    }

    this.raf = requestAnimationFrame(this._loop.bind(this));
  }

  _dinoDrawLeft(p) {
    const ducking = !!(p.phys && p.phys.ducking);
    // distance = mundo no centro da tela do dino. DINO_X e so deslocamento na tela.
    return ducking ? (p.distance - DUCK_LEFT) : (p.distance - DINO_W / 2);
  }

  _dinoHitboxes(p) {
    const ducking = !!(p.phys && p.phys.ducking);
    const yOff = (p.phys && p.phys.y) || 0;
    const left = this._dinoDrawLeft(p);
    if (ducking) {
      // sprite 59x17, corpo visivel ~x 0-50. caixa = peito/cabeca, nao o rabo
      return [{
        x: left + 16,
        y: yOff + 1,
        w: 28,
        h: 15,
        visualRight: left + 50,
      }];
    }
    return [{
      x: left + 14,
      y: yOff + 4,
      w: 18,
      h: 36,
      visualRight: left + DINO_W - 1,
    }];
  }

  _obsHitboxes(o) {
    if (o.type === 'bird') {
      return [{
        x: o.absDistance - 6,
        y: BIRD_FROM_GROUND + 8,
        w: 14,
        h: 12,
        visualLeft: o.absDistance - BIRD_W / 2 + 6,
      }];
    }
    const parts = (o.parts && o.parts.length) ? o.parts : [{ dx: 0, w: o.width || 24, h: o.height || 40 }];
    return parts.map((part) => {
      const w = part.w || 30;
      const h = part.h || 44;
      return {
        x: o.absDistance + part.dx - 5,
        y: 0,
        w: 10,
        h: h - 6,
        visualLeft: o.absDistance + part.dx - w / 2 + 3,
      };
    });
  }

  _overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  _snapToTouch(p, hitBox) {
    const dinoBox = this._dinoHitboxes(p)[0];
    const dinoRight = dinoBox.visualRight;
    const obsLeft = hitBox.visualLeft;
    const gap = obsLeft - dinoRight + 2;
    if (Math.abs(gap) < 160) {
      p.distance += gap;
      p.displayDistance = p.distance;
    }
  }

  _checkLocalCollisions() {
    const p = this.local;
    if (!p.alive) return;
    if (p.distance < 80) return;
    const dinoWorldX = p.distance;
    const dinoBoxes = this._dinoHitboxes(p);
    const obs = this.track.visibleIn(dinoWorldX - 80, dinoWorldX + 80);
    for (const o of obs) {
      if (o.hasShield && !p.collected.has(o.index)) {
        const shieldX = o.absDistance - 90;
        if (Math.abs(shieldX - dinoWorldX) < 18 && p.phys.y < 40) {
          p.collected.add(o.index);
          p.phys.shield = true;
          Sound.shield();
        }
      }
      const boxes = this._obsHitboxes(o);
      let hitBox = null;
      for (const ob of boxes) {
        if (dinoBoxes.some((db) => this._overlap(db, ob))) { hitBox = ob; break; }
      }
      if (hitBox) {
        if (p.phys.shield) {
          p.phys.shield = false;
          p.collected.add(o.index);
          Sound.shield();
        } else {
          this._snapToTouch(p, hitBox);
          p.alive = false;
          Sound.hit();
        }
      }
    }
  }

  _render() {
    const ctx = this.ctx;
    const w = this.width, h = this.height;
    const night = this.dayNight === 1;
    const bg = night ? '#2b3040' : '#f2f2f2';
    const fg = night ? '#e7ebf5' : '#535353';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.players.forEach((p, i) => {
      const laneY = i * this.laneHeight;
      this._renderLane(p, laneY, this.laneHeight, fg, night, p.isLocal);
    });
  }

  _colorHex(p) {
    if (typeof colorById === 'function') return colorById(p.color).hex;
    return '#535353';
  }

  _renderLane(p, laneTop, laneH, fg, night, isLocal) {
    const ctx = this.ctx;
    const groundY = laneTop + laneH - GROUND_MARGIN;
    const dist = p.displayDistance;
    const hex = this._colorHex(p);

    ctx.strokeStyle = night ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.moveTo(0, laneTop); ctx.lineTo(this.width, laneTop); ctx.stroke();

    ctx.font = '700 12px Courier New, monospace';
    ctx.fillStyle = p.alive ? hex : '#9a3b32';
    const label = `${p.isBot ? '[bot] ' : ''}${p.name}${isLocal ? ' (voce)' : ''}${!p.alive ? ' X' : ''}`;
    ctx.fillText(label, 8, laneTop + 16);
    if (!p.isLocal) {
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.floor(p.displayDistance / 10)).padStart(5, '0'), this.width - 8, laneTop + 16);
      ctx.textAlign = 'left';
    }

    // nuvens (parallax, so decoracao)
    const cloudShift = (dist * 0.3);
    for (let i = 0; i < 4; i++) {
      const period = 280 + i * 40;
      const cx = ((i * 170 + 90 - cloudShift) % (this.width + 80)) - 40;
      const cy = laneTop + 18 + (i % 3) * 10;
      CloudArt.draw(ctx, cx, cy, night);
    }

    // chao estilo chrome: linha + pedrinhas + ondulas
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(this.width, groundY); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    const origin = dist % 240;
    for (let gx = -20; gx < this.width + 40; gx += 12) {
      const world = dist + gx;
      const n = Math.abs(Math.sin(world * 0.17) * Math.sin(world * 0.05));
      if (n > 0.72) {
        const bh = 2 + ((world | 0) % 3);
        ctx.fillRect(gx, groundY - bh, 6 + ((world | 0) % 5), bh);
      }
      if (((world * 13) | 0) % 7 === 0) {
        ctx.fillRect(gx, groundY + 3 + ((world | 0) % 4), 2, 2);
      }
    }

    const obs = this.track.visibleIn(dist - 60, dist + this.width + 60);
    for (const o of obs) {
      const x = DINO_X + (o.absDistance - dist);
      if (x < -80 || x > this.width + 80) continue;
      if (o.hasShield && !p.collected.has(o.index)) {
        this._drawShield(x - 90, groundY - 60, night);
      }
      this._drawObstacle(o, x, groundY, night);
    }

    let poseY = 0, ducking = false, dead = !p.alive;
    if (isLocal) {
      poseY = p.phys.y; ducking = p.phys.ducking;
    } else {
      const idx = this.track.nextIndexNear(dist + DINO_X);
      const next = this.track.get(idx);
      const distTo = next.absDistance - (dist + DINO_X);
      if (p.alive && distTo < 70 && distTo > -30) {
        if (next.duckRequired) ducking = true;
        else poseY = Math.max(0, 46 * Math.sin(Math.PI * Math.min(1, Math.max(0, (70 - distTo) / 90))));
      }
    }
    DinoArt.draw(ctx, DINO_X, groundY, poseY, ducking, dead, p.phys && p.phys.shield, hex);
  }

  _drawObstacle(o, x, groundY, night) {
    if (o.type === 'bird') {
      BirdArt.draw(this.ctx, x, groundY, night);
      return;
    }
    const parts = (o.parts && o.parts.length) ? o.parts : [{ kind: o.type === 'cactus_big' ? 1 : 0, dx: 0, w: o.width || 30, h: o.height || 44 }];
    for (const part of parts) {
      CactusArt.draw(this.ctx, part.kind, x + part.dx, groundY, part.w, part.h, night);
    }
  }

  _drawShield(x, y, night) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y + Math.sin(performance.now() / 200) * 4);
    ctx.fillStyle = night ? '#8fd4c4' : '#2e7d70';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillRect(-2, -10, 4, 4);
    ctx.fillRect(-2, 6, 4, 4);
    ctx.restore();
  }
}

function drawBrandDino(canvas, colorHex) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  DinoArt.draw(ctx, w / 2, h - 6, 0, false, false, false, colorHex || '#535353');
}
