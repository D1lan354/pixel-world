// ─── СИСТЕМА КОЛЬОРІВ aaa–zzz ────────────────────────────────────────────────

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

export function hslToRgb(h, s, l) {
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

export function indexToRGB(idx) {
  const h = (idx / 15000) * 360;
  const layer = Math.floor(idx / 1500);
  const s = 45 + (layer % 5) * 12;
  const l = 30 + (layer % 3) * 13;
  return hslToRgb(h, s, l);
}

export function indexToHex(idx) {
  const { r, g, b } = indexToRGB(idx);
  return rgbToHex(r, g, b);
}

export function rgbToHex(r, g, b) {
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

export function codeToHex(code) {
  return indexToHex(codeToIndex(code));
}

// Знайти найближчий код до довільного RGB
export function nearestCode(r, g, b) {
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < 15000; i++) {
    const c = indexToRGB(i);
    const dr = (r - c.r) * 0.299;
    const dg = (g - c.g) * 0.587;
    const db = (b - c.b) * 0.114;
    const dist = dr*dr + dg*dg + db*db;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    if (bestDist < 8) break;
  }
  return indexToCode(bestIdx);
}

// 50 кольорів для свотчів + 6 відтінків сірого/чорного/білого
export function generatePaletteSwatches(count = 50) {
  const result = [];
  // 44 кольори по колу
  for (let i = 0; i < 44; i++) {
    const idx = Math.floor((i / 44) * 15000);
    result.push({ code: indexToCode(idx), hex: indexToHex(idx) });
  }
  // 6 відтінків сірого: чорний → білий
  const grays = [0, 51, 102, 153, 204, 255];
  grays.forEach(v => {
    result.push({ code: nearestCode(v, v, v), hex: rgbToHex(v, v, v) });
  });
  return result;
}

// Кольори для карти
export const MAP_WATER_CODE = nearestCode(70, 150, 220);
export const MAP_WATER_DEEP = nearestCode(30, 80, 160);
export const MAP_LAND_CODE  = nearestCode(255, 255, 255); // білий суходіл
export const MAP_SHORE_CODE = nearestCode(220, 220, 220); // берег трохи темніший
