// PRNG deterministico (mulberry32). Mesma seed = mesma sequencia sempre.
const TRACK_START = 560; // primeiro obstaculo bem a frente do spawn
function createRNG(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Variantes de cacto (indices do sprite)
// 0 = pequeno A, 1 = grande, 2 = pequeno B
const CACTUS_KIND = [
  { id: 0, w: 30, h: 44, hitW: 10, hitH: 36 },
  { id: 1, w: 36, h: 62, hitW: 12, hitH: 50 },
  { id: 2, w: 28, h: 44, hitW: 10, hitH: 36 },
];

function layoutCactus(rngA, rngB) {
  const pickSmall = () => (rngB < 0.5 ? 0 : 2);
  const roll = rngA;
  if (roll < 0.34) {
    const k = pickSmall();
    return { type: 'cactus', parts: [{ kind: k, dx: 0 }] };
  }
  if (roll < 0.54) {
    return { type: 'cactus', parts: [{ kind: 1, dx: 0 }] };
  }
  if (roll < 0.70) {
    const a = pickSmall();
    const b = a === 0 ? 2 : 0;
    return { type: 'cactus', parts: [{ kind: a, dx: -14 }, { kind: b, dx: 14 }] };
  }
  if (roll < 0.84) {
    return { type: 'cactus', parts: [{ kind: pickSmall(), dx: -18 }, { kind: 1, dx: 16 }] };
  }
  if (roll < 0.94) {
    return { type: 'cactus', parts: [{ kind: 1, dx: -16 }, { kind: pickSmall(), dx: 18 }] };
  }
  return {
    type: 'cactus',
    parts: [
      { kind: 0, dx: -24 },
      { kind: 1, dx: 0 },
      { kind: 2, dx: 24 },
    ],
  };
}

function obstacleAt(seed, index) {
  const rng = createRNG(seed + index * 7919);
  const r1 = rng();
  const r2 = rng();
  const r3 = rng();
  const r4 = rng();

  const baseGap = 440 - Math.min(index * 0.35, 60);

  if (r1 < 0.16) {
    const gap = baseGap + r2 * 260 + 20;
    return {
      index,
      type: 'bird',
      width: 42,
      height: 30,
      duckRequired: true,
      hasCoin: index > 3 && r3 > 0.87,
      parts: [],
      gap: Math.round(gap),
    };
  }

  const layout = layoutCactus(r1, r4);
  const parts = layout.parts.map((p) => {
    const k = CACTUS_KIND[p.kind];
    return {
      kind: p.kind,
      dx: p.dx,
      w: k.w,
      h: k.h,
      hitW: k.hitW,
      hitH: k.hitH,
    };
  });
  const minX = Math.min(...parts.map((p) => p.dx - p.w / 2));
  const maxX = Math.max(...parts.map((p) => p.dx + p.w / 2));
  const width = maxX - minX;
  const height = Math.max(...parts.map((p) => p.h));
  const extraGap = width > 40 ? 40 : 0;
  const gap = baseGap + r2 * 280 + extraGap;

  return {
    index,
    type: 'cactus',
    width,
    height,
    duckRequired: false,
    hasCoin: index > 3 && r3 > 0.87,
    parts,
    gap: Math.round(gap),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createRNG, obstacleAt, TRACK_START };
}
