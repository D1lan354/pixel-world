// ==========================================
// 1. ВИПРАВЛЕНИЙ ЗАПИС (Функція для player.js)
// ==========================================
function sendPixel(x, y, colorCode) {
    if(!window.currentUser) return false;
    
    // ВАЖЛИВО: Пишемо саме вкладено Y -> X
    // Це дозволить і генератору, і плеєру бачити одні й ті самі дані
    database.ref('multiplayer_map/' + y + '/' + x).set(colorCode);
    
    // Оновлюємо локально
    if (!window.mapData[y]) window.mapData[y] = {};
    window.mapData[y][x] = colorCode;
    
    return true; 
}
function loadMapFromFirebase() {
    console.log("Завантаження карти...");
    // Звертаємось рівно до тієї гілки, яку ти показав на скріншоті
    db.ref('multiplayer_map').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            window.mapData = data; 
            renderFullMap(); // Викликаємо рендер
            console.log("Карта в пам'яті, починаю малювати!");
        }
    });
}

function renderFullMap() {
    // Чистимо канвас
    ctx.fillStyle = "#afe7f3"; // Колір води (фон)
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Перебираємо Y (рядки)
    for (let y in window.mapData) {
        // Перебираємо X (колонки)
        for (let x in window.mapData[y]) {
            let colorCode = window.mapData[y][x];
            // Малюємо піксель, якщо він є в палітрі
            if (colorPaletteMap[colorCode]) {
                ctx.fillStyle = colorPaletteMap[colorCode];
                ctx.fillRect(parseInt(x), parseInt(y), 1, 1);
            }
        }
    }
}

// ==========================================
// 2. ВИПРАВЛЕНЕ ЗЧИТУВАННЯ (для player.js)
// ==========================================
function loadMapFromFirebase() {
    database.ref('multiplayer_map').on('value', (snapshot) => {
        window.mapData = snapshot.val() || {};
        // Оновлюємо екран після завантаження
        if (typeof window.redrawCanvas === "function") {
            window.redrawCanvas();
        }
    });
}
