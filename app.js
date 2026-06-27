import { db, auth } from "./firebase-config.js";
import {
  collection, doc, setDoc, onSnapshot, query, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ─── КОЛІРНА СИСТЕМА aaa–zzz ────────────────────────────────────────────────

export function codeToIndex(code) {
  const a = code.charCodeAt(0) - 97;
  const b = code.charCodeAt(1) - 97;
  const c = code.charCodeAt(2) - 97;
  return a * 676 + b * 26 + c; // 0 – 17575
}

export function indexToCode(idx) {
  const a = Math.floor(idx / 676);
  const b = Math.floor((idx % 676) / 26);
  const c = idx % 26;
  return String.fromCharCode(97 + a, 97 + b, 97 + c);
}

export function indexToHex(idx) {
  // Рівномірний розподіл по HSL-колу
  const h = (idx / 15000) * 360;
  const s = 55 + (idx % 9) * 5;   // 55–95%
  const l = 38 + (idx % 7) * 4;   // 38–62%
  return hslToHex(h, s, l);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// ─── CANVAS ──────────────────────────────────────────────────────────────────

const CANVAS_SIZE = 64; // 64×64 пікселі (можна збільшити пізніше)
const PIXEL_SIZE = 10;  // розмір одного пікселя на екрані (px)

let canvas, ctx;
let selectedCode = "aaa"; // поточний вибраний колір
let currentUser = null;

export function initCanvas() {
  canvas = document.getElementById("pixel-canvas");
  canvas.width = CANVAS_SIZE * PIXEL_SIZE;
  canvas.height = CANVAS_SIZE * PIXEL_SIZE;
  ctx = canvas.getContext("2d");

  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("mousemove", onCanvasHover);

  // Слухаємо зміни з Firestore у реальному часі
  const pixelsRef = collection(db, "canvas");
  onSnapshot(query(pixelsRef, limit(4096)), (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added" || change.type === "modified") {
        const data = change.doc.data();
        drawPixel(data.x, data.y, data.colorCode);
      }
    });
  });
}

function onCanvasClick(e) {
  if (!currentUser) {
    alert("Увійди, щоб малювати!");
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((e.clientX - rect.left) * scaleX) / PIXEL_SIZE);
  const y = Math.floor(((e.clientY - rect.top) * scaleY) / PIXEL_SIZE);
  placePixel(x, y, selectedCode);
}

function onCanvasHover(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const x = Math.floor(((e.clientX - rect.left) * scaleX) / PIXEL_SIZE);
  const y = Math.floor(((e.clientY - rect.top) * scaleY) / PIXEL_SIZE);
  const scaleY = canvas.height / rect.height;
  document.getElementById("coords").textContent = `x:${x} y:${y} → ${selectedCode}`;
}

function drawPixel(x, y, code) {
  ctx.fillStyle = indexToHex(codeToIndex(code));
  ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);

  // Тонка сітка
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.strokeRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
}

// ─── FIREBASE: ЗАПИС ПІКСЕЛЯ ─────────────────────────────────────────────────

async function placePixel(x, y, colorCode) {
  const id = `${x}_${y}`;
  await setDoc(doc(db, "canvas", id), {
    x,
    y,
    colorCode,
    userId: currentUser.uid,
    userEmail: currentUser.email,
    placedAt: Date.now()
  });
  // Локальний рендер одразу (без чекання Firestore)
  drawPixel(x, y, colorCode);
}

// ─── ВИБІР КОЛЬОРУ ───────────────────────────────────────────────────────────

export function buildPalette(containerId, count = 125) {
  const container = document.getElementById(containerId);
  for (let i = 0; i < count; i++) {
    // Рівномірна вибірка з 15000 кольорів
    const idx = Math.floor((i / count) * 15000);
    const code = indexToCode(idx);
    const hex = indexToHex(idx);

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.backgroundColor = hex;
    swatch.title = code;
    swatch.addEventListener("click", () => {
      selectedCode = code;
      document.getElementById("selected-color").style.backgroundColor = hex;
      document.getElementById("selected-code").textContent = code;
    });
    container.appendChild(swatch);
  }
}

// ─── AUDIO ENGINE (Web Audio API) ─────────────────────────────────────────────

let audioCtx = null;

export function playFormula(formulaStr, durationSec = 1.5) {
  if (!audioCtx) audioCtx = new AudioContext();

  const sr = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, sr * durationSec, sr);
  const data = buffer.getChannelData(0);

  let fn;
  try {
    // formulaStr — формула від користувача, наприклад:
    // "Math.sin(t * 440 * 2 * Math.PI) * Math.exp(-t * 3)"
    fn = new Function("t", `return ${formulaStr}`);
  } catch {
    alert("Помилка у формулі!");
    return;
  }

  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const val = fn(t);
    data[i] = Math.max(-1, Math.min(1, isNaN(val) ? 0 : val));
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}

// ─── АУТЕНТИФІКАЦІЯ ───────────────────────────────────────────────────────────

export function initAuth() {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    const statusEl = document.getElementById("auth-status");
    const formEl = document.getElementById("auth-form");

    if (user) {
      statusEl.textContent = `✓ ${user.email}`;
      formEl.style.display = "none";
      document.getElementById("logout-btn").style.display = "inline-block";
    } else {
      statusEl.textContent = "Не увійшов";
      formEl.style.display = "flex";
      document.getElementById("logout-btn").style.display = "none";
    }
  });
}

export async function register(email, password) {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert("Помилка реєстрації: " + e.message);
  }
}

export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert("Помилка входу: " + e.message);
  }
}

export async function logout() {
  await signOut(auth);
}
