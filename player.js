// ==========================================
// ВИПРАВЛЕНА ЛОГІКА КОРДИНАТ ТА ЗУМУ
// ==========================================

// Функція для отримання правильних координат пікселя
function getMousePos(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    // Рахуємо X та Y відносно того, де зараз початок канвасу (rect.left/top)
    // і ділимо на поточний zoom
    const x = Math.floor((event.clientX - rect.left) / zoomLevel);
    const y = Math.floor((event.clientY - rect.top) / zoomLevel);
    return { x, y };
}

// Оновлена функція обробки кліку
function handleCanvasClick(event) {
    if (currentCooldown >= 300) return;

    const pos = getMousePos(canvas, event);
    
    // Перевірка меж (щоб не ставило за кілометр)
    if (pos.x < 0 || pos.y < 0 || pos.x >= MAP_SIZE || pos.y >= MAP_SIZE) return;

    const brushSize = parseInt(brushSelect.value) || 1;
    const half = Math.floor(brushSize / 2);

    for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
            const tx = pos.x + dx;
            const ty = pos.y + dy;

            if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
                // Прямий запис у базу з ключем y/x
                database.ref(`multiplayer_map/${ty}/${tx}`).set(currentColorCode);
                
                // Локальне малювання
                if (!mapData[ty]) mapData[ty] = {};
                mapData[ty][tx] = currentColorCode;
                drawPixel(tx, ty, currentColorCode);
            }
        }
    }
}

// Оновлений зум, щоб він працював відносно центру курсора
function handleWheelZoom(event) {
    event.preventDefault();
    
    const mouseX = event.clientX - canvas.getBoundingClientRect().left;
    const mouseY = event.clientY - canvas.getBoundingClientRect().top;

    const zoomSpeed = 0.1;
    const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    
    const newZoom = Math.min(Math.max(zoomLevel + delta, 0.5), 15.0);
    
    // Центрування зуму
    posX -= (mouseX / zoomLevel) * delta;
    posY -= (mouseY / zoomLevel) * delta;
    
    zoomLevel = newZoom;
    
    canvas.style.transform = `translate(${posX}px, ${posY}px) scale(${zoomLevel})`;
    document.getElementById("zoomVal").innerText = `${Math.round(zoomLevel * 100)}%`;
}
