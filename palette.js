// ─── ПАЛІТРА: COLOR WHEEL + SWATCHES + NEAREST MATCH ─────────────────────────

import { nearestCode, indexToHex, indexToRGB, generatePaletteSwatches, codeToHex, codeToIndex } from "./colors.js";
import { setSelectedCode } from "./app.js";

let paletteMode = "wheel"; // "wheel" | "swatches"

export function initPalette() {
  buildWheel();
  buildSwatches();
  renderPaletteMode();

  document.getElementById("palette-toggle").addEventListener("click", () => {
    paletteMode = paletteMode === "wheel" ? "swatches" : "wheel";
    renderPaletteMode();
  });
}

function renderPaletteMode() {
  const btn = document.getElementById("palette-toggle");
  document.getElementById("palette-wheel-wrap").style.display = paletteMode === "wheel" ? "block" : "none";
  document.getElementById("palette-swatches-wrap").style.display = paletteMode === "swatches" ? "block" : "none";
  btn.textContent = paletteMode === "wheel" ? "↔ Переключити на свотчі" : "↔ Переключити на колесо";
}

// ─── COLOR WHEEL ─────────────────────────────────────────────────────────────

function buildWheel() {
  const wrap = document.getElementById("palette-wheel-wrap");
  const size = 170;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.style.borderRadius = "50%";
  c.style.cursor = "crosshair";
  c.style.display = "block";
  c.style.margin = "0 auto";
  wrap.appendChild(c);

  // Легенда
  const hint = document.createElement("p");
  hint.className = "palette-hint";
  hint.textContent = "Клік — підбирає найближчий із 15k кольорів";
  wrap.appendChild(hint);

  const ctx = c.getContext("2d");
  drawWheel(ctx, size);

  c.addEventListener("click", e => {
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = size / 2, cy = size / 2;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > size/2) return;

    // Колесо: кут → відтінок, відстань від центру → насиченість
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    const sat   = Math.round((dist / (size/2)) * 100);
    const light = 45; // фіксована яскравість

    const r = hslToR(angle, sat, light);
    const g = hslToG(angle, sat, light);
    const b = hslToB(angle, sat, light);

    const code = nearestCode(r, g, b);
    setSelectedCode(code);

    // Підсвічуємо вибраний пікс на колесі
    drawWheel(ctx, size);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI*2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI*2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Слайдер яскравості
  const lWrap = document.createElement("div");
  lWrap.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:8px";
  const lLabel = document.createElement("span");
  lLabel.className = "palette-hint";
  lLabel.textContent = "L:";
  const lSlider = document.createElement("input");
  lSlider.type = "range"; lSlider.min = 15; lSlider.max = 80; lSlider.value = 45;
  lSlider.style.flex = "1";
  lSlider.addEventListener("input", () => drawWheel(ctx, size, parseInt(lSlider.value)));
  lWrap.appendChild(lLabel);
  lWrap.appendChild(lSlider);
  wrap.appendChild(lWrap);
}

function drawWheel(ctx, size, lightness = 45) {
  const cx = size/2, cy = size/2, r = size/2;
  ctx.clearRect(0, 0, size, size);
  const imageData = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > r) continue;
      const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      const sat = (dist / r) * 100;
      const i = (y * size + x) * 4;
      imageData.data[i]   = hslToR(angle, sat, lightness);
      imageData.data[i+1] = hslToG(angle, sat, lightness);
      imageData.data[i+2] = hslToB(angle, sat, lightness);
      imageData.data[i+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── SWATCHES (50 кольорів) ───────────────────────────────────────────────────

function buildSwatches() {
  const wrap = document.getElementById("palette-swatches-wrap");
  const grid = document.createElement("div");
  grid.style.cssText = "display:flex;flex-wrap:wrap;gap:3px";

  const swatches = generatePaletteSwatches(50);
  swatches.forEach(({ code, hex }) => {
    const s = document.createElement("div");
    s.className = "swatch";
    s.style.backgroundColor = hex;
    s.title = code;
    s.addEventListener("click", () => setSelectedCode(code));
    grid.appendChild(s);
  });

  wrap.appendChild(grid);

  const hint = document.createElement("p");
  hint.className = "palette-hint";
  hint.style.marginTop = "6px";
  hint.textContent = "50 рівномірних кольорів із 15 000";
  wrap.appendChild(hint);
}

// ─── HSL утиліти (без залежностей) ───────────────────────────────────────────

function hslComponents(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}
const hslToR = (h,s,l) => hslComponents(h,s,l)[0];
const hslToG = (h,s,l) => hslComponents(h,s,l)[1];
const hslToB = (h,s,l) => hslComponents(h,s,l)[2];
