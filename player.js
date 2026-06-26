// === КОНФІГУРАЦІЯ БАЗИ ДАНИХ FIREBASE ===
const firebaseConfig = {
    databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// === ГЛОБАЛЬНІ ЗМІННІ СТАНУ ГРИ ===
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport');

let currentCooldown = 0; // Максимум 300
let currentColorCode = "aaa"; // "aaa" = білий, "zaa" = світло-блакитна вода
let zoomLevel = 1.0;
const MAP_SIZE = 2048;

// Словник перекладу коротких кодів у реальні кольори для Canvas
const colorPaletteMap = {
    "aaa": "#ffffff", // Біла суша
    "zaa": "#afe7f3", // Світло-блакитна вода континентів
    "rhh": "#a65d5d"  // Світло-коричневий / червонуватий колір гравців
};

// Протилежний пошук (з hex у твій короткий 3-символьний код)
function getCodeFromHex(hex) {
    for (let code in colorPaletteMap) {
        if (colorPaletteMap[code] === hex.toLowerCase()) return code;
    }
    return "rhh"; // За замовчуванням даємо кастомний колір, якщо в палітрі немає
}

// === ІНІЦІАЛІЗАЦІЯ ТА СЛУХАЧІ ПОДІЙ ===
window.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupZoomAndPan();
    startCooldownSystem();
});

function initApp() {
    // 1. Завантажуємо первинну мапу з бази даних
    database.ref().once('value').then((snapshot) => {
        const fullData = snapshot.val();
        if (fullData) {
            renderFullMap(fullData);
        }
        // Вмикаємо онлайн-оновлення в реальному часі для змін
        listenToLiveUpdates();
    });

    // 2. Логіка вибору кольору через квадрат
    const activeColorBox = document.getElementById('activeColorBox');
    const colorPicker = document.getElementById('colorPicker');
    
    activeColorBox.addEventListener('click', () => colorPicker.click());
    colorPicker.addEventListener('input', (e) => {
        const hex = e.target.value;
        activeColorBox.style.backgroundColor = hex;
        // Перетворюємо у внутрішній формат (3 символи)
        currentColorCode = getCodeFromHex(hex);
        document.getElementById('colorCodeText').innerText = currentColorCode;
    });
    
    // 3. Відслідковування руху миші для оновлення координат в меню
    canvas.addEventListener('mousemove', updateMouseCoordinates);
    
    // 4. Головна подія: КЛІК МИШКОЮ (Малювання пікселями)
    canvas.addEventListener('mousedown', handleCanvasClick);
}

// === РЕНДЕР КАРТИ ТА ОНЛАЙН СИНХРОНІЗАЦІЯ ===
function renderFullMap(data) {
    const imgData = ctx.createImageData(MAP_SIZE, MAP_SIZE);
    
    for (let y = 0; y < MAP_SIZE; y++) {
        if (!data[y]) continue;
        for (let x = 0; x < MAP_SIZE; x++) {
            const code = data[y][x] || "zaa"; // Якщо пусто — малюється вода
            const hex = colorPaletteMap[code] || "#afe7f3";
            
            // Парсимо HEX в RGB для швидкого заповнення масиву canvas
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            
            const idx = (y * MAP_SIZE + x) * 4;
            imgData.data[idx] = r;
            imgData.data[idx+1] = g;
            imgData.data[idx+2] = b;
            imgData.data[idx+3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

function listenToLiveUpdates() {
    // Слухаємо лише останні точкові зміни в базі, щоб не перевантажувати мережу
    database.ref().on('child_changed', (snapshot) => {
        const y = snapshot.key;
        const rowData = snapshot.val();
        for (let x in rowData) {
            drawSinglePixelLocal(parseInt(x), parseInt(y), rowData[x]);
        }
    });
}

function drawSinglePixelLocal(x, y, code) {
    ctx.fillStyle = colorPaletteMap[code] || "#afe7f3";
    ctx.fillRect(x, y, 1, 1);
}

// === МАТЕМАТИКА КЛІКУ, ПЕНЗЛЯ ТА КУЛДАУНУ ===
function handleCanvasClick(event) {
    // Перевірка на Ctrl+Клік (Піпетка)
    if (event.ctrlKey) {
        executePipette(event);
        return;
    }

    // 1. НАЙВАЖЛИВІШЕ: Перевірка перегріву перед виконанням коду
    if (currentCooldown >= 300) {
        console.warn("Кулдаун активований! Зачекайте охолодження.");
        return; 
    }

    // Отримуємо координати кліку з урахуванням поточного рівня зуму
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.floor((event.clientX - rect.left) / zoomLevel);
    const clickY = Math.floor((event.clientY - rect.top) / zoomLevel);

    // Зчитуємо поточний розмір пензля із селектора (1 чи 5)
    const brushSize = parseInt(document.getElementById('brushSizeSelect').value) || 1;
    const halfBrush = Math.floor(brushSize / 2);
    
    let totalPixelsPaintedInThisClick = 0;
    let updatesBatch = {};

    // 2. Цикл малювання по матриці навколо кліку
    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
        for (let dx = -halfBrush; dx <= halfBrush; dx++) {
            const tx = clickX + dx;
            const ty = clickY + dy;

            // Перевірка границь карти
            if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
                // Малюємо локально для миттєвого відгуку у гравця
                drawSinglePixelLocal(tx, ty, currentColorCode);
                
                // Швидка відправка у Firebase
                database.ref(`${ty}/${tx}`).set(currentColorCode);
                
                totalPixelsPaintedInThisClick++;
            }
        }
    }

    // 3. Рахуємо кулдаун за кожен фактично пофарбований піксель
    // Наприклад: 1 піксель = +2с кулдауну, клік 5x5 (25 пікселів) = +50с кулдауну.
    currentCooldown += totalPixelsPaintedInThisClick * 2.0; 
    if (currentCooldown > 300) currentCooldown = 300;

    updateCooldownUI();
}

// Функція піпетки (Ctrl + Клік бере колір з карти)
function executePipette(event) {
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor((event.clientX - rect.left) / zoomLevel);
    const cy = Math.floor((event.clientY - rect.top) / zoomLevel);
    
    try {
        const pixelData = ctx.getImageData(cx, cy, 1, 1).data;
        const hex = "#" + ("0" + pixelData[0].toString(16)).slice(-2) +
                          ("0" + pixelData[1].toString(16)).slice(-2) +
                          ("0" + pixelData[2].toString(16)).slice(-2);
        
        document.getElementById('activeColorBox').style.backgroundColor = hex;
        currentColorCode = getCodeFromHex(hex);
        document.getElementById('colorCodeText').innerText = currentColorCode;
    } catch(e) { console.error("Помилка піпетки:", e); }
}

// === СИСТЕМА ОХОЛОДЖЕННЯ ТА ІНТЕРФЕЙСУ ===
function startCooldownSystem() {
    // Кожні 100 мілісекунд стабільно зменшуємо кулдаун (охолодження процесу)
    setInterval(() => {
        if (currentCooldown > 0) {
            currentCooldown -= 0.5; // Швидкість охолодження
            if (currentCooldown < 0) currentCooldown = 0;
            updateCooldownUI();
        }
    }, 100);
}

function updateCooldownUI() {
    document.getElementById('cooldownTimerText').innerText = currentCooldown.toFixed(1) + "с";
    const percentage = (currentCooldown / 300) * 100;
    
    const bar = document.getElementById('cooldownProgressBar');
    bar.style.width = `${percentage}%`;

    // Зміна кольору смужки при критичному перегріві
    if (currentCooldown >= 250) {
        bar.style.background = "linear-gradient(90deg, #ff3333, #ff6600)";
    } else {
        bar.style.background = "linear-gradient(90deg, #00ff88, #00ffcc)";
    }
}

function updateMouseCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / zoomLevel);
    const y = Math.floor((event.clientY - rect.top) / zoomLevel);
    
    if(x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
        document.getElementById('coordX').innerText = x;
        document.getElementById('coordY').innerText = y;
    }
}

// === КЕРУВАННЯ МАСШТАБОМ (ЗУМ КОЛІЩАТКОМ) ===
function setupZoomAndPan() {
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const zoomSpeed = 0.15;
        if (e.deltaY < 0) {
            zoomLevel += zoomSpeed;
        } else {
            zoomLevel -= zoomSpeed;
        }
        
        // Ліміти масштабу: від 20% до 1200%
        if (zoomLevel < 0.2) zoomLevel = 0.2;
        if (zoomLevel > 12) zoomLevel = 12;

        canvas.style.transform = `scale(${zoomLevel})`;
        canvas.style.transformOrigin = "top left";
        document.getElementById('zoomVal').innerText = Math.round(zoomLevel * 100) + "%";
    }, { passive: false });
}

// Повне адмін-очищення онлайн-карти (скидання у воду)
async function clearFullOnlineMap() {
    if (!confirm("Ви дійсно хочете ПОВНІСТЮ ОЧИСТИТИ онлайн-карту та залити її водою?")) return;
    
    const rowData = {};
    for(let x=0; x<MAP_SIZE; x++) rowData[x] = "zaa"; // Код води

    for(let y=0; y<MAP_SIZE; y++) {
        await database.ref(`${y}`).set(rowData);
    }
    alert("Карту успішно очищено!");
}
