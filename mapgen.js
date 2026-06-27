// ─── ГЕНЕРАТОР КАРТИ 1352×1024 ───────────────────────────────────────────────

import { nearestCode, MAP_WATER_CODE, MAP_WATER_DEEP, MAP_LAND_CODE, MAP_SHORE_CODE, rgbToHex } from './colors.js';

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

const PERM = new Uint8Array(512);
function seedPermutation(seed) {
  const p = Array.from({length: 256}, (_, i) => i);
  let s = seed | 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function grad(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function noise2d(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = PERM[X] + Y, b = PERM[X+1] + Y;
  return lerp(
    lerp(grad(PERM[a],   x,   y),   grad(PERM[b],   x-1, y),   u),
    lerp(grad(PERM[a+1], x,   y-1), grad(PERM[b+1], x-1, y-1), u),
    v
  );
}

function fbm(x, y, octaves = 7) {
  let val = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2d(x * freq, y * freq) * amp;
    max += amp; amp *= 0.48; freq *= 2.05;
  }
  return val / max;
}

export function generateMap(width, height, seed = Math.random() * 99999 | 0, onProgress) {
  seedPermutation(seed);
  const numContinents = 4 + Math.floor(((seed * 7) % 1000) / 333); // 4–6

  // Розміщуємо центри континентів — рівномірно по longitude
  const centers = [];
  for (let i = 0; i < numContinents; i++) {
    const angle  = (i / numContinents) * Math.PI * 2 + (((seed + i * 137) % 100) / 100) * 0.9;
    const radius = 0.22 + (((seed * (i+3)) % 100) / 100) * 0.12;
    const latOff = ((seed * (i+7)) % 100 - 50) / 200; // зміщення по широті
    centers.push({
      x:    0.5 + Math.cos(angle) * radius * 1.5,
      y:    0.5 + Math.sin(angle) * radius * 0.65 + latOff,
      size: 0.11 + (((seed * (i+13)) % 100) / 100) * 0.09
    });
  }

  const map = new Uint16Array(width * height); // індекси кодів
  const codeCache = new Map();

  function getCode(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    if (!codeCache.has(key)) codeCache.set(key, nearestCode(r, g, b));
    return codeCache.get(key);
  }

  for (let py = 0; py < height; py++) {
    if (onProgress && py % 64 === 0) onProgress(py / height);

    for (let px = 0; px < width; px++) {
      const nx = px / width;
      const ny = py / height;

      // Відстань до найближчого континенту
      let minDist = Infinity;
      for (const c of centers) {
        const dx = (nx - c.x) * (width / height); // корекція аспекту
        const dy = ny - c.y;
        const dist = Math.sqrt(dx*dx + dy*dy) / c.size;
        if (dist < minDist) minDist = dist;
      }

      // Шум для нерівних берегів (більше деталей)
      const n  = fbm(nx * 5 + seed * 0.0007, ny * 5 + seed * 0.0009);
      const n2 = fbm(nx * 12 + 3.7,          ny * 12 + 1.3) * 0.15;
      const noiseEff = n * 0.5 + n2;

      // Полярне fade (менше суші біля країв)
      const polar = Math.pow(Math.abs(ny - 0.5) * 2, 1.6) * 0.4;

      const elevation = 1.0 - minDist + noiseEff - polar;

      let r, g, b;
      if (elevation > 0.22) {
        // Суходіл — білий
        r = 255; g = 255; b = 255;
      } else if (elevation > 0.10) {
        // Берег — трохи сірий
        const t = (elevation - 0.10) / 0.12;
        r = Math.round(lerp(200, 255, t));
        g = Math.round(lerp(200, 255, t));
        b = Math.round(lerp(200, 255, t));
      } else {
        // Вода — голуба, глибша = темніша
        const depth = Math.max(0, Math.min(1, (-elevation + 0.10) * 2));
        r = Math.round(lerp(100, 20, depth));
        g = Math.round(lerp(180, 80, depth));
        b = Math.round(lerp(255, 160, depth));
      }

      map[py * width + px] = codeToIndex_local(getCode(r, g, b));
    }
  }

  return { map, width, height, seed, numContinents, getCodeAt: (x, y) => {
    const idx = map[y * width + x];
    return indexToCode_local(idx);
  }};
}

// Локальні копії щоб не імпортувати зворотно
function codeToIndex_local(code) {
  const a = code.charCodeAt(0) - 97;
  const b = code.charCodeAt(1) - 97;
  const c = code.charCodeAt(2) - 97;
  return a * 676 + b * 26 + c;
}
function indexToCode_local(idx) {
  const a = Math.floor(idx / 676);
  const b = Math.floor((idx % 676) / 26);
  const c = idx % 26;
  return String.fromCharCode(97 + a, 97 + b, 97 + c);
}
