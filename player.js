const firebaseConfig = { databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const mapRef = db.ref('multiplayer_map');

const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");
const grid = document.getElementById("gridLayer");
const MAP_SIZE = 2048;
canvas.width = canvas.height = MAP_SIZE;
grid.style.width = grid.style.height = `${MAP_SIZE}px`;

let zoomLevel = 1.0;
let mapData = {};
let colorPaletteMap = { "aaa": "#ffffff", "zaa": "#afe7f3", "rhh": "#a65d5d" };

// 1. Завантаження та відображення
mapRef.on('value', (snapshot) => {
    mapData = snapshot.val() || {};
    renderMap();
});

function renderMap() {
    ctx.fillStyle = colorPaletteMap["zaa"];
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    for (let y in mapData) {
        for (let x in mapData[y]) {
            drawPixel(parseInt(x), parseInt(y), mapData[y][x]);
        }
    }
}

function drawPixel(x, y, colorCode) {
    ctx.fillStyle = colorPaletteMap[colorCode] || colorCode;
    ctx.fillRect(x, y, 1, 1);
}

// 2. Логіка сітки (границь)
function updateGrid() {
    if (zoomLevel > 10) {
        grid.style.display = 'block';
        grid.style.backgroundSize = `${zoomLevel}px ${zoomLevel}px`;
        grid.style.transform = canvas.style.transform;
    } else {
        grid.style.display = 'none';
    }
}

// 3. Збереження пікселя в базу (викликай це при кліку)
function savePixel(x, y, colorCode) {
    // Зберігаємо код у базу
    db.ref(`multiplayer_map/${y}/${x}`).set(colorCode);
    
    // Якщо це новий кастомний колір, можна додати його в локальний словник для відображення
    if (!colorPaletteMap[colorCode]) {
        colorPaletteMap[colorCode] = colorCode; // Якщо прийшов hex
    }
}

// Слухач оновлень з бази (для синхронізації між гравцями)
mapRef.on('child_changed', (snapshot) => {
    const y = snapshot.key;
    const row = snapshot.val();
    for (let x in row) {
        mapData[y] = mapData[y] || {};
        mapData[y][x] = row[x];
        drawPixel(parseInt(x), parseInt(y), row[x]);
    }
});
