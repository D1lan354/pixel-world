import { db, auth } from "./firebase-config.js";
import { collection, doc, setDoc, onSnapshot, query, limit, writeBatch } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { codeToIndex, indexToHex, codeToHex, nearestCode, generatePaletteSwatches } from "./colors.js";
import { generateMap } from "./mapgen.js";

// ─── СТАН ────────────────────────────────────────────────────────────────────

const CANVAS_W = 128;
const CANVAS_H = 128;
const BASE_PX  = 6; // базовий розмір пікселя

let canvas, ctx, offscreen, offCtx;
let pixelData = {};          // { "x_y": code }
let selectedCode = "mno";
let currentUser = null;

// Режими: 'draw' або 'pan'
let mode = 'draw';
let drawOnHold = false;      // малювання зажатою мишею

// Вид (pan + zoom)
let view = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let panStart = { x: 0, y: 0, vx: 0, vy: 0 };
let isDrawing = false;

// Піпетка
let eyedropperActive = false;

// ─── ІНІЦІАЛІЗАЦІЯ CANVAS ─────────────────────────────────────────────────────

export function initCanvas() {
  canvas = document.getElementById("pixel-canvas");
  offscreen = document.createElement("canvas");
  offscreen.width  = CANVAS_W;
  offscreen.height = CANVAS_H;
  offCtx = offscreen.getContext("2d");

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Малюємо сітку спочатку
  clearOffscreen();

  canvas.addEventListener("mousedown",  onMouseDown);
  canvas.addEventListener("mousemove",  onMouseMove);
  canvas.addEventListener("mouseup",    onMouseUp);
  canvas.addEventListener("mouseleave", onMouseUp);
  canvas.addEventListener("wheel",      onWheel, { passive: false });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  // Клавіатура
  window.addEventListener("keydown", e => {
    if (e.key === "Shift") setMode("pan");
    if (e.key === "Control" || e.key === "Meta") {
      eyedropperActive = true;
      canvas.style.cursor = "crosshair";
    }
  });
  window.addEventListener("keyup", e => {
    if (e.key === "Shift") setMode("draw");
    if (e.key === "Control" || e.key === "Meta") {
      eyedropperActive = false;
      updateCursor();
    }
  });

  // Firebase real-time
  const q = query(collection(db, "canvas"), limit(20000));
  onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added" || change.type === "modified") {
        const d = change.doc.data();
        pixelData[`${d.x}_${d.y}`] = d.colorCode;
        drawPixelOffscreen(d.x, d.y, d.colorCode);
      }
    });
    render();
  });

  centerView();
  render();

  // Прокидаємо для зум-кнопок з HTML
  window._pixelView       = view;
  window._pixelRender     = render;
  window._pixelCenterView = centerView;
}

function resizeCanvas() {
  canvas.width  = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  render();
}

function clearOffscreen() {
  offCtx.fillStyle = "#0a0f1a";
  offCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawPixelOffscreen(x, y, code) {
  offCtx.fillStyle = codeToHex(code);
  offCtx.fillRect(x, y, 1, 1);
}

function centerView() {
  view.zoom = Math.min(canvas.width / CANVAS_W, canvas.height / CANVAS_H) * 0.85;
  view.x = (canvas.width  - CANVAS_W * view.zoom) / 2;
  view.y = (canvas.height - CANVAS_H * view.zoom) / 2;
}

// ─── РЕНДЕР ───────────────────────────────────────────────────────────────────

function render() {
  if (!ctx) {
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Фон
  ctx.fillStyle = "#0a0f1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);

  // Зображення пікселів
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0);

  // Сітка (тільки якщо зум достатній)
  if (view.zoom > 4) {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1 / view.zoom;
    for (let x = 0; x <= CANVAS_W; x++) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }
  }

  ctx.restore();
}

// ─── КООРДИНАТИ ───────────────────────────────────────────────────────────────

function screenToPixel(sx, sy) {
  return {
    x: Math.floor((sx - view.x) / view.zoom),
    y: Math.floor((sy - view.y) / view.zoom)
  };
}

function inBounds(x, y) {
  return x >= 0 && x < CANVAS_W && y >= 0 && y < CANVAS_H;
}

// ─── ПОДІЇ МИШІ ───────────────────────────────────────────────────────────────

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const { x, y } = screenToPixel(sx, sy);

  if (e.button === 1 || mode === "pan") {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    canvas.style.cursor = "grabbing";
    return;
  }

  if (eyedropperActive && inBounds(x, y)) {
    pickColor(x, y);
    return;
  }

  if (mode === "draw") {
    isDrawing = true;
    if (inBounds(x, y)) tryPlace(x, y);
  }
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const { x, y } = screenToPixel(sx, sy);

  // Оновлення координат у хедері
  const coordEl = document.getElementById("coords");
  if (coordEl) {
    coordEl.textContent = inBounds(x,y) ? `x:${x} y:${y} [${selectedCode}]` : "";
  }

  if (isPanning) {
    view.x = panStart.vx + (e.clientX - panStart.x);
    view.y = panStart.vy + (e.clientY - panStart.y);
    render();
    return;
  }

  if (isDrawing && drawOnHold && mode === "draw" && inBounds(x, y)) {
    tryPlace(x, y);
  }
}

function onMouseUp(e) {
  isPanning = false;
  isDrawing = false;
  updateCursor();
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const newZoom = Math.max(0.5, Math.min(40, view.zoom * factor));

  // Зум відносно позиції миші
  view.x = mx - (mx - view.x) * (newZoom / view.zoom);
  view.y = my - (my - view.y) * (newZoom / view.zoom);
  view.zoom = newZoom;
  render();
}

// ─── МАЛЮВАННЯ ────────────────────────────────────────────────────────────────

let lastPlaced = "";
async function tryPlace(x, y) {
  const key = `${x}_${y}`;
  if (lastPlaced === key) return; // не перемальовувати той самий
  lastPlaced = key;
  if (!currentUser) { showAuthPrompt(); return; }

  pixelData[key] = selectedCode;
  drawPixelOffscreen(x, y, selectedCode);
  render();

  await setDoc(doc(db, "canvas", key), {
    x, y, colorCode: selectedCode,
    userId: currentUser.uid,
    userEmail: currentUser.email,
    placedAt: Date.now()
  });
}

// Піпетка — підбирає колір з полотна
function pickColor(x, y) {
  const key = `${x}_${y}`;
  const code = pixelData[key];
  if (code) {
    setSelectedCode(code);
  } else {
    // Читаємо пікселі з offscreen canvas
    const px = offCtx.getImageData(x, y, 1, 1).data;
    const code2 = nearestCode(px[0], px[1], px[2]);
    setSelectedCode(code2);
  }
}

// ─── ГЕНЕРАТОР КАРТИ ─────────────────────────────────────────────────────────

export async function generateAndApplyMap(seed) {
  const { map } = generateMap(CANVAS_W, CANVAS_H, seed);
  const batch = writeBatch(db);

  clearOffscreen();

  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const code = map[y * CANVAS_W + x];
      const key = `${x}_${y}`;
      pixelData[key] = code;
      drawPixelOffscreen(x, y, code);

      const ref = doc(db, "canvas", key);
      batch.set(ref, {
        x, y, colorCode: code,
        userId: currentUser?.uid || "system",
        userEmail: currentUser?.email || "mapgen",
        placedAt: Date.now()
      });
    }
  }

  render();

  // Firebase дозволяє max 500 записів за раз у batch
  // Ділимо на чанки
  const total = CANVAS_W * CANVAS_H;
  const CHUNK = 400;
  for (let i = 0; i < total; i += CHUNK) {
    const b = writeBatch(db);
    for (let j = i; j < Math.min(i + CHUNK, total); j++) {
      const px = j % CANVAS_W, py = Math.floor(j / CANVAS_W);
      const code = map[j];
      b.set(doc(db, "canvas", `${px}_${py}`), {
        x: px, y: py, colorCode: code,
        userId: currentUser?.uid || "system",
        userEmail: "mapgen",
        placedAt: Date.now()
      });
    }
    await b.commit();
  }

  document.getElementById("map-status").textContent = "Карта збережена!";
  setTimeout(() => { document.getElementById("map-status").textContent = ""; }, 3000);
}

// ─── РЕЖИМИ ───────────────────────────────────────────────────────────────────

export function setMode(m) {
  mode = m;
  const drawBtn = document.getElementById("mode-draw");
  const panBtn  = document.getElementById("mode-pan");
  if (drawBtn) drawBtn.classList.toggle("active", m === "draw");
  if (panBtn)  panBtn.classList.toggle("active", m === "pan");
  updateCursor();
}

export function toggleDrawOnHold(val) {
  drawOnHold = val;
}

function updateCursor() {
  if (eyedropperActive) { canvas.style.cursor = "crosshair"; return; }
  canvas.style.cursor = mode === "pan" ? "grab" : "cell";
}

export function setSelectedCode(code) {
  selectedCode = code;
  const hex = codeToHex(code);
  const el = document.getElementById("selected-color");
  const cd = document.getElementById("selected-code");
  if (el) el.style.backgroundColor = hex;
  if (cd) cd.textContent = code;
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

export function initAuth() {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    const status = document.getElementById("auth-status");
    const form   = document.getElementById("auth-form");
    const logoutBtn = document.getElementById("logout-btn");

    if (user) {
      if (status) status.textContent = `✓ ${user.email}`;
      if (form)   form.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
      if (status) status.textContent = "Не увійшов";
      if (form)   form.style.display = "flex";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  });
}

export async function register(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch(e) {
    showError("Реєстрація: " + friendlyError(e.code));
  }
}

export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch(e) {
    showError("Вхід: " + friendlyError(e.code));
  }
}

export async function logout() {
  await signOut(auth);
}

function friendlyError(code) {
  const map = {
    "auth/network-request-failed": "Немає з'єднання з Firebase. Перевір firebaseConfig у firebase-config.js та авторизовані домени у Firebase Console → Authentication → Settings → Authorized domains",
    "auth/invalid-email": "Невірний формат email",
    "auth/weak-password": "Пароль мінімум 6 символів",
    "auth/email-already-in-use": "Цей email вже зареєстровано",
    "auth/user-not-found": "Користувач не знайдений",
    "auth/wrong-password": "Невірний пароль",
  };
  return map[code] || code;
}

function showError(msg) {
  const el = document.getElementById("auth-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
  else alert(msg);
}

function showAuthPrompt() {
  const el = document.getElementById("auth-error");
  if (el) { el.textContent = "Увійди щоб малювати!"; el.style.display = "block"; }
}

// ─── AUDIO ────────────────────────────────────────────────────────────────────

let audioCtx = null;
export function playFormula(formulaStr, duration = 1.5) {
  if (!audioCtx) audioCtx = new AudioContext();
  const sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, sr * duration, sr);
  const data = buf.getChannelData(0);
  let fn;
  try { fn = new Function("t", `"use strict"; return ${formulaStr}`); }
  catch { showError("Помилка у формулі!"); return; }
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    try { const v = fn(t); data[i] = isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0; }
    catch { data[i] = 0; }
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start();
}
