// ─── ГЕНЕРАТОР КАРТИ СВІТУ ────────────────────────────────────────────────────
// Генерує 4–6 великих континентів, решта — вода

import { nearestCode, MAP_WATER_CODE, MAP_LAND_CODE, MAP_SHORE_CODE } from './colors.js';

// Простий псевдо-Perlin шум (без залежностей)
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

const PERM = new Uint8Array(512);
function seedPermutation(seed) {
  // Детермінований shuffle за seed
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
    lerp(grad(PERM[a], x, y),   grad(PERM[b], x-1, y),   u),
    lerp(grad(PERM[a+1], x, y-1), grad(PERM[b+1], x-1, y-1), u),
    v
  );
}

// Фрактальний шум (кілька октав)
function fbm(x, y, octaves = 6) {
  let val = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2d(x * freq, y * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / max;
}

// Основна функція генерації карти
export function generateMap(width, height, seed = Math.random() * 10000 | 0) {
  seedPermutation(seed);

  const numContinents = 4 + Math.floor(Math.random() * 3); // 4–6
  const map = new Array(width * height);

  // Центри континентів (рівномірно розподілені)
  const centers = [];
  for (let i = 0; i < numContinents; i++) {
    const angle = (i / numContinents) * Math.PI * 2 + Math.random() * 0.5;
    const radius = 0.25 + Math.random() * 0.15;
    centers.push({
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius * 0.6,
      size: 0.12 + Math.random() * 0.1
    });
  }

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const nx = px / width;
      const ny = py / height;

      // Відстань до найближчого центру континенту
      let minDist = Infinity;
      for (const c of centers) {
        const dx = (nx - c.x) * 1.6; // стиснення по X для більш округлих континентів
        const dy = ny - c.y;
        const dist = Math.sqrt(dx*dx + dy*dy) / c.size;
        if (dist < minDist) minDist = dist;
      }

      // Шум для нерівних берегів
      const n = fbm(nx * 4 + seed * 0.001, ny * 4 + seed * 0.0013);
      const noiseEffect = n * 0.45;

      // Полярне зменшення (щоб на полюсах менше суші)
      const polarFade = Math.abs(ny - 0.5) * 1.4;

      const elevation = 1.0 - minDist + noiseEffect - polarFade * 0.3;

      let code;
      if (elevation > 0.18) {
        code = MAP_LAND_CODE;             // суходіл
      } else if (elevation > 0.08) {
        code = MAP_SHORE_CODE;            // узбережжя
      } else {
        // Різні відтінки води залежно від глибини
        const depth = Math.max(0, -elevation);
        const waterR = Math.round(lerp(65, 20, Math.min(depth * 3, 1)));
        const waterG = Math.round(lerp(130, 60, Math.min(depth * 3, 1)));
        const waterB = Math.round(lerp(200, 140, Math.min(depth * 3, 1)));
        code = nearestCode(waterR, waterG, waterB);
      }

      map[py * width + px] = code;
    }
  }

  return { map, width, height, seed, numContinents };
}
