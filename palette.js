// ─── ПАЛІТРА: HSB КОЛЕСО + КВАДРАТ + СВОТЧІ ──────────────────────────────────

import { nearestCode, generatePaletteSwatches, codeToHex, hslToRgb, rgbToHex } from "./colors.js";
import { setSelectedCode } from "./app.js";

let paletteMode = "wheel"; // "wheel" | "swatches"
let currentHue = 0;

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
  btn.textContent = paletteMode === "wheel" ? "↔ Свотчі" : "↔ Колесо";
}

// ─── HSB COLOR WHEEL ─────────────────────────────────────────────────────────
//  Зовнішнє кільце = відтінок (Hue)
//  Внутрішній квадрат = насиченість (X) + яскравість (Y)

function buildWheel() {
  const wrap = document.getElementById("palette-wheel-wrap");

  const SIZE  = 176;
  const RING  = 18;   // ширина кільця відтінку
  const SQ    = SIZE - RING * 2 - 10; // сторона квадрату

  // Контейнер
  const container = document.createElement("div");
  container.style.cssText = "position:relative;width:176px;height:176px;margin:0 auto 8px";

  // Canvas для кільця
  const ringCanvas = document.createElement("canvas");
  ringCanvas.width = ringCanvas.height = SIZE;
  ringCanvas.style.cssText = "position:absolute;top:0;left:0;cursor:crosshair";
  drawHueRing(ringCanvas, SIZE, RING);
  container.appendChild(ringCanvas);

  // Canvas для квадрату
  const sqCanvas = document.createElement("canvas");
  sqCanvas.width = sqCanvas.height = SQ;
  const sqOff = RING + 5;
  sqCanvas.style.cssText = `position:absolute;top:${sqOff}px;left:${sqOff}px;cursor:crosshair`;
  drawSatBriSquare(sqCanvas, currentHue);
  container.appendChild(sqCanvas);

  // Маркер на кільці
  const ringMarker = document.createElement("div");
  ringMarker.style.cssText = "position:absolute;width:8px;height:8px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 3px #000;pointer-events:none;transform:translate(-50%,-50%)";
  container.appendChild(ringMarker);
  updateRingMarker(ringMarker, currentHue, SIZE, RING);

  // Маркер на квадраті
  const sqMarker = document.createElement("div");
  sqMarker.style.cssText = "position:absolute;width:8px;height:8px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 3px #000;pointer-events:none;transform:translate(-50%,-50%)";
  sqMarker.style.left = `${sqOff + SQ}px`;
  sqMarker.style.top  = `${sqOff}px`;
  container.appendChild(sqMarker);

  // Поточний sat/bri (0–1)
  let sat = 1, bri = 1;

  function pickAndSet() {
    // HSB → HSL → RGB → nearestCode
    const rgb = hsbToRgb(currentHue, sat, bri);
    const code = nearestCode(rgb.r, rgb.g, rgb.b);
    setSelectedCode(code);
    // Оновити превью
    const pw = document.getElementById("palette-preview");
    if (pw) pw.style.backgroundColor = rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  // Клік по кільцю → вибрати відтінок
  ringCanvas.addEventListener("mousedown", function dragRing(e) {
    function move(ev) {
      const rect = ringCanvas.getBoundingClientRect();
      const cx = SIZE/2, cy = SIZE/2;
      const dx = (ev.clientX - rect.left) - cx;
      const dy = (ev.clientY - rect.top)  - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const inner = SIZE/2 - RING, outer = SIZE/2;
      if (dist < inner - 4 || dist > outer + 4) return;
      currentHue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      drawSatBriSquare(sqCanvas, currentHue);
      updateRingMarker(ringMarker, currentHue, SIZE, RING);
      pickAndSet();
    }
    move(e);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", () => window.removeEventListener("mousemove", move), { once: true });
  });

  // Клік по квадрату → вибрати насиченість/яскравість
  sqCanvas.addEventListener("mousedown", function dragSq(e) {
    function move(ev) {
      const rect = sqCanvas.getBoundingClientRect();
      sat = Math.max(0, Math.min(1, (ev.clientX - rect.left) / SQ));
      bri = Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / SQ));
      // Оновити маркер
      sqMarker.style.left = `${sqOff + sat * SQ}px`;
      sqMarker.style.top  = `${sqOff + (1 - bri) * SQ}px`;
      pickAndSet();
    }
    move(e);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", () => window.removeEventListener("mousemove", move), { once: true });
  });

  wrap.appendChild(container);

  const hint = document.createElement("p");
  hint.className = "palette-hint";
  hint.textContent = "Кільце=відтінок · Квадрат=яскравість/насиченість";
  wrap.appendChild(hint);
}

function drawHueRing(canvas, size, ringW) {
  const ctx = canvas.getContext("2d");
  const cx = size/2, cy = size/2, r = size/2;
  ctx.clearRect(0, 0, size, size);

  // Малюємо кільце сегментами
  const steps = 360;
  for (let i = 0; i < steps; i++) {
    const a1 = (i / steps) * Math.PI * 2 - Math.PI/2;
    const a2 = ((i+1.5) / steps) * Math.PI * 2 - Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(cx + (r - ringW) * Math.cos(a1), cy + (r - ringW) * Math.sin(a1));
    ctx.arc(cx, cy, r,     a1, a2);
    ctx.arc(cx, cy, r - ringW, a2, a1, true);
    ctx.closePath();
    ctx.fillStyle = `hsl(${i},100%,50%)`;
    ctx.fill();
  }
}

function drawSatBriSquare(canvas, hue) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = x / W, b = 1 - y / H;
      const { r, g, bl } = hsbToRgbRaw(hue, s, b);
      const idx = (y * W + x) * 4;
      img.data[idx]   = r;
      img.data[idx+1] = g;
      img.data[idx+2] = bl;
      img.data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function updateRingMarker(el, hue, size, ringW) {
  const r = size/2 - ringW/2;
  const a = (hue - 90) * Math.PI / 180;
  el.style.left = `${size/2 + r * Math.cos(a)}px`;
  el.style.top  = `${size/2 + r * Math.sin(a)}px`;
}

// HSB → {r,g,b}  (b=1 is white)
function hsbToRgbRaw(h, s, b) {
  const i = Math.floor(h / 60) % 6;
  const f = h/60 - Math.floor(h/60);
  const p = b * (1 - s), q = b * (1 - f*s), t = b * (1 - (1-f)*s);
  const vals = [[b,t,p],[q,b,p],[p,b,t],[p,q,b],[t,p,b],[b,p,q]][i];
  return { r: Math.round(vals[0]*255), g: Math.round(vals[1]*255), bl: Math.round(vals[2]*255) };
}

function hsbToRgb(h, s, b) {
  const { r, g, bl } = hsbToRgbRaw(h, s, b);
  return { r, g, b: bl };
}

// ─── SWATCHES ─────────────────────────────────────────────────────────────────
function buildSwatches() {
  const wrap = document.getElementById("palette-swatches-wrap");
  const grid = document.createElement("div");
  grid.style.cssText = "display:flex;flex-wrap:wrap;gap:3px";

  const swatches = generatePaletteSwatches(50);
  swatches.forEach(({ code, hex }) => {
    const s = document.createElement("div");
    s.className = "swatch";
    s.style.cssText = `background:${hex};width:17px;height:17px;border-radius:3px;cursor:pointer;transition:transform .1s`;
    s.title = code;
    s.addEventListener("mouseover", () => s.style.transform = "scale(1.5)");
    s.addEventListener("mouseout",  () => s.style.transform = "");
    s.addEventListener("click", () => setSelectedCode(code));
    grid.appendChild(s);
  });
  wrap.appendChild(grid);
  const hint = document.createElement("p");
  hint.className = "palette-hint";
  hint.style.marginTop = "6px";
  hint.textContent = "44 кольори + 6 відтінків сірого/чорного/білого";
  wrap.appendChild(hint);
}
