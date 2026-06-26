function executeBrushPainting(baseX, baseY) {
    if (cooldownTime >= MAX_COOLDOWN || !window.currentUser) return;
    
    const brushSelector = document.getElementById('brushSizeSelector');
    const size = brushSelector ? parseInt(brushSelector.value) : 1;
    let offset = Math.floor(size / 2);
    
    let pixelsToPaint = [];

    // 1. Збираємо всі пікселі з області пензля
    for (let dx = -offset; dx <= offset; dx++) {
        for (let dy = -offset; dy <= offset; dy++) {
            let tx = baseX + dx;
            let ty = baseY + dy;
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                pixelsToPaint.push({x: tx, y: ty});
            }
        }
    }

    // 2. Рандомізуємо чергу малювання (алгоритм Фішера-Єйтса)
    for (let i = pixelsToPaint.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pixelsToPaint[i], pixelsToPaint[j]] = [pixelsToPaint[j], pixelsToPaint[i]];
    }

    let delay = 0;
    let anyPixelPainted = false;

    // 3. Малюємо тільки ті, на які вистачає кулдауну
    pixelsToPaint.forEach((pixel) => {
        // Якщо під час малювання чергового пікселя ліміт вичерпано — зупиняємо процес повністю
        if (cooldownTime >= MAX_COOLDOWN) return;

        setTimeout(() => {
            if (cooldownTime >= MAX_COOLDOWN) return;
            
            let success = sendPixel(pixel.x, pixel.y, selectedCode);
            if (success) {
                anyPixelPainted = true;
                cooldownTime += 0.8; // Нагрів за один піксель
                
                if (cooldownTime > MAX_COOLDOWN) cooldownTime = MAX_COOLDOWN;
                localStorage.setItem('pixel_cooldown', cooldownTime);
                updateCooldownUI();
            }
        }, delay);
        
        delay += 15; // Захисний інтервал для Firebase
    });

    // Звуковий ефект відтворюється лише якщо хоча б один піксель успішно вліз
    setTimeout(() => {
        if (anyPixelPainted) {
            playSoundFX();
            clickCount++;
            const clicksEl = document.getElementById('hudClicks');
            if (clicksEl) clicksEl.innerText = clickCount;
        }
    }, delay + 5);
}
