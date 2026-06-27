import { db, auth } from "./firebase-config.js";
import {
  collection, doc, setDoc, onSnapshot, query, limit, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { codeToIndex, indexToHex, codeToHex, nearestCode } from "./colors.js";
import { generateMap } from "./mapgen.js";

// ─── РОЗМІР ПОЛОТНА ───────────────────────────────────────────────────────────
export const CANVAS_W = 1352;
export const CANVAS_H = 1024;

// ─── СТАН ────────────────────────────────────────────────────────────────────
let canvas, ctx, offscreen, offCtx;
let pixelData    = {};
export let selectedCode = "zzz";
let currentUser  = null;

// Режим 1: клік=піксель, затиск=пан
// Режим 2 (Shift): затиск=малювати
let drawMode = 1;

let view = { x: 0, y: 0, zoom: 1 };
let mouse = { down: false, button: -1, x: 0, y: 0 };
let lastPixel = "";

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function initCanvas() {
  canvas    = document.getElementById("pixel-canvas");
  offscreen = document.createElement("canvas");
  offscreen.width  = CANVAS_W;
  offscreen.height = CANVAS_H;
  offCtx = offscreen.getContext("2d");
  ctx    = canvas.getContext("2d");
  ctx.imageSmoothingEnabled    = false;
  offCtx.imageSmoothingEnabled = false;

  fillOffscreen("#0a1525");
  resizeCanvas();
  window.addEventListener("resize", () => { resizeCanvas(); render(); });

  canvas.addEventListener("mousedown",  onMD);
  canvas.addEventListener("mousemove",  onMM);
  canvas.addEventListener("mouseup",    onMU);
  canvas.addEventListener("mouseleave", onMU);
  canvas.addEventListener("wheel",      onWheel, { passive: false });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  window.addEventListener("keydown", e => {
    if (e.key === "Shift" && drawMode === 1) setDrawMode(2);
  });
  window.addEventListener("keyup", e => {
    if (e.key === "Shift" && drawMode === 2) setDrawMode(1);
  });

  // Firebase live updates
  const q = query(collection(db, "canvas"), limit(50000));
  onSnapshot(q, snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === "added" || ch.type === "modified") {
        const d = ch.doc.data();
        pixelData[`${d.x}_${d.y}`] = d.colorCode;
        paintPx(d.x, d.y, d.colorCode);
      }
    });
    render();
  });

  centerView();
  render();

  window._pixelView       = view;
  window._pixelRender     = render;
  window._pixelCenterView = centerView;
  window._pickColor       = pickColor;
}

function resizeCanvas() {
  canvas.width  = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  ctx.imageSmoothingEnabled = false;
}

function fillOffscreen(color) {
  offCtx.fillStyle = color;
  offCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function paintPx(x, y, code) {
  offCtx.fillStyle = codeToHex(code);
  offCtx.fillRect(x, y, 1, 1);
}

export function centerView() {
  const s = Math.min(canvas.width / CANVAS_W, canvas.height / CANVAS_H) * 0.88;
  view.zoom = s;
  view.x = (canvas.width  - CANVAS_W * s) / 2;
  view.y = (canvas.height - CANVAS_H * s) / 2;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#07090f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0);

  // Сітка при великому зумі
  if (view.zoom > 6) {
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1 / view.zoom;
    for (let x = 0; x <= CANVAS_W; x += 1) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += 1) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }
  }
  ctx.restore();
}

function screenToPixel(sx, sy) {
  return {
    x: Math.floor((sx - view.x) / view.zoom),
    y: Math.floor((sy - view.y) / view.zoom)
  };
}
function inBounds(x, y) {
  return x >= 0 && x < CANVAS_W && y >= 0 && y < CANVAS_H;
}

// ─── MOUSE ────────────────────────────────────────────────────────────────────
function onMD(e) {
  const { x, y } = getPixelCoords(e);
  mouse.down = true;
  mouse.button = e.button;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  lastPixel = "";

  // Піпетка: Ctrl/Meta + клік
  if ((e.ctrlKey || e.metaKey) && inBounds(x, y)) {
    pickColor(x, y); return;
  }

  if (drawMode === 1) {
    // Режим 1: ЛКМ без затиску = один піксель; затиск почнеться в onMM
    if (e.button === 0 && inBounds(x, y)) tryPlace(x, y);
  } else {
    // Режим 2 (Shift утримано): затиск = малювати
    if (e.button === 0 && inBounds(x, y)) tryPlace(x, y);
  }
}

function onMM(e) {
  const { x, y } = getPixelCoords(e);
  updateCoords(x, y);

  if (!mouse.down) return;

  const dx = e.clientX - mouse.x;
  const dy = e.clientY - mouse.y;

  if (drawMode === 1) {
    // Режим 1: затиск = пан
    view.x += dx; view.y += dy;
    mouse.x = e.clientX; mouse.y = e.clientY;
    render();
  } else {
    // Режим 2: затиск = малювати безперервно
    if (e.button === 0 || mouse.button === 0) {
      if (inBounds(x, y)) tryPlace(x, y);
    }
  }
}

function onMU(e) {
  mouse.down = false;
  mouse.button = -1;
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
  const newZ = Math.max(0.08, Math.min(40, view.zoom * factor));
  view.x = mx - (mx - view.x) * (newZ / view.zoom);
  view.y = my - (my - view.y) * (newZ / view.zoom);
  view.zoom = newZ;
  render();
}

function getPixelCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return screenToPixel(e.clientX - rect.left, e.clientY - rect.top);
}

function updateCoords(x, y) {
  const el = document.getElementById("coords");
  if (el) el.textContent = inBounds(x,y) ? `${x} : ${y}  [${selectedCode}]` : "";
}

// ─── МАЛЮВАННЯ ────────────────────────────────────────────────────────────────
async function tryPlace(x, y) {
  const key = `${x}_${y}`;
  if (key === lastPixel) return;
  lastPixel = key;
  if (!currentUser) { showMsg("Увійди щоб малювати!"); return; }

  pixelData[key] = selectedCode;
  paintPx(x, y, selectedCode);
  render();

  try {
    await setDoc(doc(db, "canvas", key), {
      x, y, colorCode: selectedCode,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      placedAt: Date.now()
    });
  } catch(err) { showMsg("Помилка збереження: " + err.message); }
}

function pickColor(x, y) {
  const key = `${x}_${y}`;
  const code = pixelData[key];
  if (code) {
    setSelectedCode(code);
  } else {
    const px = offCtx.getImageData(x, y, 1, 1).data;
    setSelectedCode(nearestCode(px[0], px[1], px[2]));
  }
}

// ─── РЕЖИМИ ───────────────────────────────────────────────────────────────────
export function setDrawMode(m) {
  drawMode = m;
  const b1 = document.getElementById("mode1-btn");
  const b2 = document.getElementById("mode2-btn");
  if (b1) { b1.classList.toggle("active", m === 1); }
  if (b2) { b2.classList.toggle("active", m === 2); }
  canvas.style.cursor = m === 1 ? "cell" : "crosshair";
  const label = document.getElementById("mode-label");
  if (label) label.textContent = m === 1
    ? "Режим 1: клік=піксель, затиск=рух"
    : "Режим 2: затиск=малювати";
}

export function setSelectedCode(code) {
  selectedCode = code;
  const hex = codeToHex(code);
  const el = document.getElementById("selected-color");
  const cd = document.getElementById("selected-code");
  if (el) el.style.backgroundColor = hex;
  if (cd) cd.textContent = code;
  // Оновити превью у палітрі
  const pw = document.getElementById("palette-preview");
  if (pw) pw.style.backgroundColor = hex;
}

// ─── ZOOM BUTTONS ─────────────────────────────────────────────────────────────
export function zoomBy(factor) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const nz = Math.max(0.08, Math.min(40, view.zoom * factor));
  view.x = cx - (cx - view.x) * (nz / view.zoom);
  view.y = cy - (cy - view.y) * (nz / view.zoom);
  view.zoom = nz;
  render();
}

// ─── MAP GENERATOR ────────────────────────────────────────────────────────────
export async function generateAndApplyMap(seed) {
  const statusEl = document.getElementById("map-status");
  if (statusEl) statusEl.textContent = "Генерую шум...";

  // Генерація у мікротасках щоб не заморозити UI
  await new Promise(r => setTimeout(r, 20));

  const { map, numContinents } = generateMap(CANVAS_W, CANVAS_H, seed, p => {
    if (statusEl) statusEl.textContent = `Генерую... ${Math.round(p*100)}%`;
  });

  if (statusEl) statusEl.textContent = `${numContinents} континентів. Малюю...`;
  await new Promise(r => setTimeout(r, 10));

  // Малюємо на offscreen
  const imgData = offCtx.createImageData(CANVAS_W, CANVAS_H);
  for (let i = 0; i < CANVAS_W * CANVAS_H; i++) {
    const code = indexToCode_local(map[i]);
    const hex = codeToHex(code);
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    imgData.data[i*4]   = r;
    imgData.data[i*4+1] = g;
    imgData.data[i*4+2] = b;
    imgData.data[i*4+3] = 255;
    const x = i % CANVAS_W, y = Math.floor(i / CANVAS_W);
    pixelData[`${x}_${y}`] = code;
  }
  offCtx.putImageData(imgData, 0, 0);
  render();

  if (statusEl) statusEl.textContent = "Зберігаю у Firebase...";

  // Batch запис 500 пікселів за раз
  const CHUNK = 490;
  const total = CANVAS_W * CANVAS_H;
  for (let start = 0; start < total; start += CHUNK) {
    const b = writeBatch(db);
    for (let i = start; i < Math.min(start + CHUNK, total); i++) {
      const px = i % CANVAS_W, py = Math.floor(i / CANVAS_W);
      const code = indexToCode_local(map[i]);
      b.set(doc(db, "canvas", `${px}_${py}`), {
        x: px, y: py, colorCode: code,
        userId: currentUser?.uid || "mapgen",
        userEmail: currentUser?.email || "mapgen",
        placedAt: Date.now()
      });
    }
    await b.commit();
    const pct = Math.round(Math.min(start + CHUNK, total) / total * 100);
    if (statusEl) statusEl.textContent = `Зберігаю... ${pct}%`;
  }

  if (statusEl) { statusEl.textContent = "✓ Готово!"; setTimeout(()=>statusEl.textContent="",4000); }
}

function indexToCode_local(idx) {
  const a = Math.floor(idx / 676);
  const b = Math.floor((idx % 676) / 26);
  const c = idx % 26;
  return String.fromCharCode(97+a, 97+b, 97+c);
}

// ─── AUDIO ────────────────────────────────────────────────────────────────────
let audioCtx = null;
export function playFormula(formulaStr, duration = 2) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const sr  = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, sr * duration, sr);
  const data = buf.getChannelData(0);
  let fn;
  try { fn = new Function("t", `"use strict"; return (${formulaStr})`); }
  catch(e) { showMsg("Помилка формули: " + e.message); return null; }
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    try {
      const v = fn(t);
      data[i] = isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    } catch { data[i] = 0; }
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(audioCtx.destination);
  src.start();
  return data; // повертаємо для відображення хвилі
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export function initAuth() {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    const status    = document.getElementById("auth-status");
    const form      = document.getElementById("auth-form");
    const logoutBtn = document.getElementById("logout-btn");
    if (user) {
      if (status)    status.textContent = `✓ ${user.email}`;
      if (form)      form.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
    } else {
      if (status)    status.textContent = "";
      if (form)      form.style.display = "flex";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  });
}

export async function register(email, password) {
  clearMsg();
  try { await createUserWithEmailAndPassword(auth, email, password); }
  catch(e) { showMsg(friendlyError(e.code)); }
}

export async function login(email, password) {
  clearMsg();
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch(e) { showMsg(friendlyError(e.code)); }
}

export async function logout() { await signOut(auth); }

function friendlyError(code) {
  return ({
    "auth/network-request-failed":
      "Немає з'єднання з Firebase. Перевір: 1) firebaseConfig у firebase-config.js  2) Firebase Console → Authentication → Settings → Authorized domains → додай localhost та свій домен",
    "auth/invalid-api-key":        "Невірний API key у firebaseConfig",
    "auth/invalid-email":          "Невірний формат email",
    "auth/weak-password":          "Пароль мінімум 6 символів",
    "auth/email-already-in-use":   "Email вже зареєстровано",
    "auth/user-not-found":         "Користувач не знайдений",
    "auth/wrong-password":         "Невірний пароль",
    "auth/too-many-requests":      "Забагато спроб — спробуй пізніше",
  })[code] || code;
}

function showMsg(msg) {
  const el = document.getElementById("auth-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
function clearMsg() {
  const el = document.getElementById("auth-error");
  if (el) el.style.display = "none";
}
