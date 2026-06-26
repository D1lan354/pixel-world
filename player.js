<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>
<script src="config.js"></script> <script src="audio.js"></script>  <script src="player.js"></script> ```
// ==========================================
// ГЛОБАЛЬНІ ЗМІННІ ТА НАЛАШТУВАННЯ
// ==========================================
const canvas = document.getElementById("pixelCanvas"); // Перевір ID свого canvas в HTML
const ctx = canvas.getContext("2d");

const MAP_SIZE = 2048;
canvas.width = MAP_SIZE;
canvas.height = MAP_SIZE;

let mapData = {}; // Тут зберігаємо всю карту з бази
let zoomLevel = 1.0;
let currentColorCode = "aaa"; // Дефолтний колір пензля (білий)
let currentCooldown = 0;

// ==========================================
// 1. ІНІЦІАЛІЗАЦІЯ ТА З'ЄДНАННЯ З FIREBASE
// ==========================================
// Припускаємо, що firebase.initializeApp вже викликано в index.html або config.js
const database = firebase.database();

// Завантажуємо карту при першому вході на сайт
function loadMapFromFirebase() {
    console.log("Завантаження карти з Firebase...");
    database.ref().once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            mapData = data; // Записуємо дані в локальний масив для перевірки кліків
            renderFullMap();
            console.log("Карту успішно завантажено та відмальовано!");
        } else {
            console.log("База даних порожня. Очікування генерації карти...");
        }
    });
}

// Слухаємо онлайн-оновлення (якщо інший гравець поставить піксель)
function listenForLiveUpdates() {
    database.ref().on('child_changed', (snapshot) => {
        const y = snapshot.key;
        const rowData = snapshot.val();
        
        if (!mapData[y]) mapData[y] = {};
        
        for (let x in rowData) {
            mapData[y][x] = rowData[x]; // Оновлюємо локальну копію
            drawPixel(parseInt(x), parseInt(y), rowData[x]); // Малюємо на екрані
        }
    });
}

// ==========================================
// 2. ФУНКЦІЇ МАЛЮВАННЯ
// ==========================================
function renderFullMap() {
    // Очищаємо канвас базовим кольором води (наприклад, блакитним)
    ctx.fillStyle = "#aae0f5"; 
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Проходимо по рядках і малюємо острови з бази
    for (let y in mapData) {
        for (let x in mapData[y]) {
            drawPixel(parseInt(x), parseInt(y), mapData[y][x]);
        }
    }
}

function drawPixel(x, y, colorCode) {
    // Конвертуємо твій код кольору (наприклад "aaa" чи "zaa") у реальний HEX/RGB
    // Якщо ти використовуєш чисті HEX коди (наприклад "#ffffff"), залиш просто colorCode
    ctx.fillStyle = colorCode.startsWith("#") ? colorCode : "#" + colorCode; 
    ctx.fillRect(x, y, 1, 1);
}

// ==========================================
// 3. ФІКС КЛІКУ ТА ЗАХИСТ ВІД СПАМУ КОЛЬОРОМ
// ==========================================
function handleCanvasClick(event) {
    if (currentCooldown > 0) {
        console.log(`Зачекайте кулдаун! Залишилось: ${currentCooldown}с`);
        return;
    }

    const rect = canvas.getBoundingClientRect();
    // Вираховуємо точні координати пікселя з урахуванням зуму
    const tx = Math.floor((event.clientX - rect.left) / zoomLevel);
    const ty = Math.floor((event.clientY - rect.top) / zoomLevel);

    // Захист від виходу за межі карти
    if (tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE) return;

    // ПЕРЕВІРКА: чи існує вже такий колір на цьому пікселі?
    const existingColor = (mapData[ty] && mapData[ty][tx]) ? mapData[ty][tx] : null;

    if (existingColor === currentColorCode) {
        console.log("БЛОКУВАННЯ: Ти малюєш по тому самому кольору! Кулдаун збережено.");
        return; // Повністю виходимо з функції. База не смикається, кулдаун не йде!
    }

    // Якщо колір новий — записуємо у Firebase
    database.ref(`${ty}/${tx}`).set(currentColorCode)
        .then(() => {
            // Оновлюємо локально, щоб наступний клік по цьому ж місцю заблокувався
            if (!mapData[ty]) mapData[ty] = {};
            mapData[ty][tx] = currentColorCode;

            // Запускаємо кулдаун (наприклад, 5 секунд)
            startCooldown(5);
        })
        .catch((error) => {
            console.error("Помилка запису в Firebase:", error);
        });
}

// ==========================================
// 4. ФІКС ЗУМУ (ОБМЕЖЕННЯ МАСШТАБУ)
// ==========================================
function handleWheelZoom(event) {
    event.preventDefault(); // Забороняємо скрол самої сторінки

    // Крок зуму
    if (event.deltaY < 0) {
        zoomLevel += 0.2; // Наближення
    } else {
        zoomLevel -= 0.2; // Віддалення
    }

    // ОБМЕЖЕННЯ: мапа не стиснеться в нуль і не розтягнеться на гігабайти
    if (zoomLevel < 0.4) zoomLevel = 0.4; // Мінімальний зум (40%)
    if (zoomLevel > 15.0) zoomLevel = 15.0; // Максимальний зум (1500%)

    // Застосовуємо трансформацію до Canvas
    canvas.style.transformOrigin = "top left"; // Фіксуємо точку відліку
    canvas.style.transform = `scale(${zoomLevel})`;

    // Оновлюємо текст зуму в UI, якщо у тебе є такий елемент
    const zoomDisplay = document.getElementById("zoomScaleDisplay");
    if (zoomDisplay) {
        zoomDisplay.innerText = `Масштаб зуму: ${Math.round(zoomLevel * 100)}%`;
    }
}

// ==========================================
// 5. ЛОГІКА КУЛДАУНУ
// ==========================================
function startCooldown(seconds) {
    currentCooldown = seconds;
    const cooldownTimerHTML = document.getElementById("cooldownTimer"); // Твій ID таймера в UI
    
    const interval = setInterval(() => {
        if (currentCooldown <= 0) {
            clearInterval(interval);
            if (cooldownTimerHTML) cooldownTimerHTML.innerText = "Готово!";
            return;
        }
        currentCooldown--;
        if (cooldownTimerHTML) cooldownTimerHTML.innerText = `Таймер: ${currentCooldown}с / 300с`;
    }, 1000);
}

// ==========================================
// 6. ПІДКЛЮЧЕННЯ СЛУХАЧІВ ПОДІЙ (ІВЕНТІВ)
// ==========================================
canvas.addEventListener("click", handleCanvasClick);
window.addEventListener("wheel", handleWheelZoom, { passive: false });

// Запуск усього при завантаженні сторінки
loadMapFromFirebase();
listenForLiveUpdates();
