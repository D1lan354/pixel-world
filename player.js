// ==========================================
// ГЛОБАЛЬНІ ЗМІННІ ТА КОНФІГУРАЦІЯ
// ==========================================
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
const viewport = document.getElementById("viewport"); // Контейнер, де лежить canvas

const MAP_SIZE = 2048;
canvas.width = MAP_SIZE;
canvas.height = MAP_SIZE;

let mapData = {}; // Локальна матриця карти для миттєвих перевірок кольору
let zoomLevel = 1.0;
let currentColorCode = "aaa"; // "aaa" = біла суша, "zaa" = світло-блакитна вода
let currentCooldown = 0;

// Твоя палітра для відображення коротких кодів на екрані
const colorPaletteMap = {
    "aaa": "#ffffff", // Суша
    "zaa": "#afe7f3", // Світло-блакитна вода континентів
    "rhh": "#a65d5d"  // Колір гравця
};

// З'єднання з Firebase (конфіг вже має бути ініціалізований в index.html)
const database = firebase.database();

// ==========================================
// 1. ЗАВАНТАЖЕННЯ ТА СИНХРОНІЗАЦІЯ З БАЗОЮ
// ==========================================
function loadMapFromFirebase() {
    console.log("Завантаження карти з Firebase...");
    database.ref().once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            mapData = data; // Зберігаємо карту в оперативку
            renderFullMap();
            console.log("Карту успішно завантажено!");
        }
    });
}

// Онлайн-оновлення: коли інший гравець малює
function listenForLiveUpdates() {
    database.ref().on('child_changed', (snapshot) => {
        const y = snapshot.key;
        const rowData = snapshot.val();
        
        if (!mapData[y]) mapData[y] = {};
        
        for (let x in rowData) {
            mapData[y][x] = rowData[x];
            drawPixel(parseInt(x), parseInt(y), rowData[x]);
        }
    });
}

function renderFullMap() {
    // Базове тло води
    ctx.fillStyle = colorPaletteMap["zaa"];
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    for (let y in mapData) {
        for (let x in mapData[y]) {
            drawPixel(parseInt(x), parseInt(y), mapData[y][x]);
        }
    }
}

function drawPixel(x, y, colorCode) {
    ctx.fillStyle = colorPaletteMap[colorCode] || "#afe7f3";
    ctx.fillRect(x, y, 1, 1);
}

// ==========================================
// 2. СИСТЕМА КЛІКУ, ПЕНЗЛЯ ТА ЗАХИСТУ ВІД СПАМУ
// ==========================================
function handleCanvasClick(event) {
    if (currentCooldown >= 300) {
        console.log("Перегрів! Зачекайте.");
        return;
    }

    const rect = canvas.getBoundingClientRect();
    // Точні координати пікселя з урахуванням зуму
    const clickX = Math.floor((event.clientX - rect.left) / zoomLevel);
    const clickY = Math.floor((event.clientY - rect.top) / zoomLevel);

    // Отримуємо розмір пензля з твого UI селектора
    const brushSelect = document.getElementById("brushSizeSelect");
    const brushSize = brushSelect ? parseInt(brushSelect.value) : 1;
    const halfBrush = Math.floor(brushSize / 2);
    
    let pixelsChanged = 0;

    // Проходимо по сітці пензля (1x1 або 5x5)
    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
        for (let dx = -halfBrush; dx <= halfBrush; dx++) {
            const tx = clickX + dx;
            const ty = clickY + dy;

            if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
                const existingColor = (mapData[ty] && mapData[ty][tx]) ? mapData[ty][tx] : "zaa";

                // НАЙВАЖЛИВІШИЙ ФІКС: якщо колір такий самий, ігноруємо цей піксель!
                if (existingColor !== currentColorCode) {
                    // Малюємо локально для швидкості
                    if (!mapData[ty]) mapData[ty] = {};
                    mapData[ty][tx] = currentColorCode;
                    drawPixel(tx, ty, currentColorCode);

                    // Відправляємо в базу
                    database.ref(`${ty}/${tx}`).set(currentColorCode);
                    pixelsChanged++;
                }
            }
        }
    }

    // Кулдаун нараховується ТІЛЬКИ за реально змінені пікселі
    if (pixelsChanged > 0) {
        currentCooldown += pixelsChanged * 2.0; // +2 секунди за кожен новий піксель
        if (currentCooldown > 300) currentCooldown = 300;
        updateCooldownUI();
    }
}

// ==========================================
// 3. ФІКС КОЛІЩАТКА (ЗУМ)
// ==========================================
function handleWheelZoom(event) {
    event.preventDefault(); // Зупиняємо стандартний скрол сторінки

    const zoomSpeed = 0.1;
    let oldZoom = zoomLevel;

    if (event.deltaY < 0) {
        zoomLevel += zoomSpeed; // Наближення
    } else {
        zoomLevel -= zoomSpeed; // Віддалення
    }

    // МЕЖІ ЗУМУ: Карта не стиснеться менше ніж 50% і не розлетиться більше 1500%
    if (zoomLevel < 0.5) zoomLevel = 0.5;
    if (zoomLevel > 15.0) zoomLevel = 15.0;

    // Застосовуємо трансформацію до Canvas
    canvas.style.transformOrigin = "0 0"; // Фіксуємо лівий верхній кут для розрахунків
    canvas.style.transform = `scale(${zoomLevel})`;

    // Оновлюємо UI відображення масштабу
    const zoomValText = document.getElementById("zoomVal");
    if (zoomValText) {
        zoomValText.innerText = `${Math.round(zoomLevel * 100)}%`;
    }
}

// ==========================================
// 4. ТАЙМЕР ОХОЛОДЖЕННЯ (UI)
// ==========================================
function startCooldownSystem() {
    setInterval(() => {
        if (currentCooldown > 0) {
            currentCooldown -= 0.5;
            if (currentCooldown < 0) currentCooldown = 0;
            updateCooldownUI();
        }
    }, 100);
}

function updateCooldownUI() {
    const timerText = document.getElementById("cooldownTimerText");
    const progressBar = document.getElementById("cooldownProgressBar");
    
    if (timerText) timerText.innerText = `${currentCooldown.toFixed(1)}с`;
    if (progressBar) {
        const percentage = (currentCooldown / 300) * 100;
        progressBar.style.width = `${percentage}%`;
    }
}

// Перевірка миші для координат в панелі
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoomLevel);
    const y = Math.floor((e.clientY - rect.top) / zoomLevel);
    
    const coordX = document.getElementById('coordX');
    const coordY = document.getElementById('coordY');
    if (coordX && coordY && x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
        coordX.innerText = x;
        coordY.innerText = y;
    }
});

// ==========================================
// 5. СЛУХАЧІ ПОДІЙ
// ==========================================
canvas.addEventListener("mousedown", handleCanvasClick);
// Вішаємо прослуховування коліщатка саме на контейнер viewport, щоб воно працювало всюди
if (viewport) {
    viewport.addEventListener("wheel", handleWheelZoom, { passive: false });
} else {
    window.addEventListener("wheel", handleWheelZoom, { passive: false });
}

// Старт гри
loadMapFromFirebase();
listenForLiveUpdates();
startCooldownSystem();
