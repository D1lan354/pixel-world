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
