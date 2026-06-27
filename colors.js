// ─── СИСТЕМА КОЛЬОРІВ aaa–zzz (15 000 кольорів) ─────────────────────────────

export function codeToIndex(code) {
  const a = code.charCodeAt(0) - 97;
  const b = code.charCodeAt(1) - 97;
  const c = code.charCodeAt(2) - 97;
  return a * 676 + b * 26 + c;
}

export function indexToCode(idx) {
  const a = Math.floor(idx / 676);
  const b = Math.floor((idx % 676) / 26);
  const c = idx % 26;
  return String.fromCharCode(97 + a, 97 + b, 97 + c);
}

// Генерує RGB для індексу 0–14999
export function indexToRGB(idx) {
  // Рівномірний розподіл по HSL-колу з варіацією насиченості/яскравості
  const h = (idx / 15000) * 360;
  const layer = Math.floor(idx / 1500); // 0–9
  const s = 45 + (layer % 5) * 12;     // 45–93%
  const l = 30 + (layer % 3) * 13;     // 30–56%
  return hslToRgb(h, s, l);
}

export function indexToHex(idx) {
  const { r, g, b } = indexToRGB(idx);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

export function codeToHex(code) {
  return indexToHex(codeToIndex(code));
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255)
  };
}

// Знаходить найближчий колір із палітри до будь-якого RGB
export function nearestCode(r, g, b) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 15000; i++) {
    const c = indexToRGB(i);
    // Зважена Евклідова відстань (людське сприйняття)
    const dr = (r - c.r) * 0.299;
    const dg = (g - c.g) * 0.587;
    const db = (b - c.b) * 0.114;
    const dist = dr*dr + dg*dg + db*db;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    if (bestDist < 10) break; // досить близько
  }
  return indexToCode(bestIdx);
}

// Генерує палітру — масив { code, hex } рівномірно по всіх 15k кольорів
export function generatePaletteSwatches(count = 50) {
  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * 15000);
    result.push({ code: indexToCode(idx), hex: indexToHex(idx) });
  }
  return result;
}

// Спеціальні кольори для карти
export const MAP_WATER_CODE = nearestCode(65, 130, 200);   // синій океан
export const MAP_LAND_CODE  = nearestCode(240, 230, 210);  // бежевий суходіл
export const MAP_SHORE_CODE = nearestCode(210, 195, 160);  // берегова лінія
