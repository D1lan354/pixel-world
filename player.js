// Розумне малювання пензлем: якщо ліміт близько, вибирає випадкові пікселі, які ще "влізуть"
function executeBrushPainting(baseX, baseY) {
    if (cooldownTime >= MAX_COOLDOWN || !window.currentUser) return;
    
    const brushSelector = document.getElementById('brushSizeSelector');
    const size = brushSelector ? parseInt(brushSelector.value) : 1;
    let offset = Math.floor(size / 2);
    
    let pixelsToPaint = [];

    // 1. Збираємо всі координати з області пензля
    for (let dx = -offset; dx <= offset; dx++) {
        for (let dy = -offset; dy <= offset; dy++) {
            let tx = baseX + dx;
            let ty = baseY + dy;
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                pixelsToPaint.push({x: tx, y: ty});
            }
        }
    }

    // 2. Перемішуємо масив (рандомізація), щоб при нестачі кулдауну малювалися випадкові точки
    for (let i = pixelsToPaint.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pixelsToPaint[i], pixelsToPaint[j]] = [pixelsToPaint[j], pixelsToPaint[i]];
    }

    let delay = 0;
    let anyPixelPainted = false;

    // 3. Перевіряємо ліміт індивідуально для кожної точки
    pixelsToPaint.forEach((pixel) => {
        if (cooldownTime >= MAX_COOLDOWN) return; // Якщо нагрівся до 300 — наступні рандомні пікселі скидаються

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
        
        delay += 15; // Затримка проти спаму Firebase
    });

    setTimeout(() => {
        if (anyPixelPainted) {
            playSoundFX();
            clickCount++;
            const clicksEl = document.getElementById('hudClicks');
            if (clicksEl) clicksEl.innerText = clickCount;
        }
    }, delay + 5);
}

// Генерація палітри кольорів
const alphabet = "abcdefghijklmnopqrstuvwxyz"; const palette = {}; 
for (let r = 0; r < 26; r++) {
    for (let g = 0; g < 26; g++) {
        for (let b = 0; b < 26; b++) {
            let rVal = Math.round(r * (255 / 25)), gVal = Math.round(g * (255 / 25)), bVal = Math.round(b * (255 / 25));
            let code = alphabet[r] + alphabet[g] + alphabet[b];
            palette[code] = { r: rVal, g: gVal, b: bVal, hex: `#${rVal.toString(16).padStart(2,'0')}${gVal.toString(16).padStart(2,'0')}${bVal.toString(16).padStart(2,'0')}` };
        }
    }
}
let selectedGameColor = "#ff0000", selectedCode = "aaa";

function findNearestColor(hexColor) {
    let r = parseInt(hexColor.slice(1, 3), 16), g = parseInt(hexColor.slice(3, 5), 16), b = parseInt(hexColor.slice(5, 7), 16);
    let minDistance = Infinity, nearestCode = "zzz", nearestHex = "#ffffff";
    for (let code in palette) {
        let p = palette[code]; let dist = Math.sqrt((r - p.r)**2 + (g - p.g)**2 + (b - p.b)**2);
        if (dist < minDistance) { minDistance = dist; nearestCode = code; nearestHex = p.hex; }
    }
    return { code: nearestCode, hex: nearestHex };
}

const picker = document.getElementById('colorPicker');
if (picker) {
    picker.addEventListener('input', (e) => {
        let nearest = findNearestColor(e.target.value);
        selectedGameColor = nearest.hex; selectedCode = nearest.code;
        const matchedBox = document.getElementById('matchedColorBox');
        const codeText = document.getElementById('colorCode');
        if (matchedBox) matchedBox.style.backgroundColor = nearest.hex;
        if (codeText) codeText.innerText = nearest.code;
    });
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
    ctx.translate(camera.x, camera.y); ctx.scale(zoom, zoom);
    
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 4 / zoom;
    ctx.strokeRect(0, 0, MAP_WIDTH * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);

    if (showGrid && zoom > 0.08) { 
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5 / zoom; ctx.beginPath();
        for (let x = 0; x <= MAP_WIDTH; x += 4) { ctx.moveTo(x * PIXEL_SIZE, 0); ctx.lineTo(x * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE); }
        for (let y = 0; y <= MAP_HEIGHT; y += 4) { ctx.moveTo(0, y * PIXEL_SIZE); ctx.lineTo(MAP_WIDTH * PIXEL_SIZE, y * PIXEL_SIZE); }
        ctx.stroke();
    }

    if (window.mapData) {
        for (let key in window.mapData) {
            let coords = key.split('_');
            let x = parseInt(coords[0]), y = parseInt(coords[1]);
            let code = window.mapData[key];
            ctx.fillStyle = palette[code] ? palette[code].hex : "#ffffff";
            ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }
    }
    ctx.restore();
}
window.redrawCanvas = redrawCanvas;

function screenToGrid(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { 
        x: Math.floor((clientX - rect.left - camera.x) / (PIXEL_SIZE * zoom)), 
        y: Math.floor((clientY - rect.top - camera.y) / (PIXEL_SIZE * zoom)) 
    };
}

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) { camera.x = e.clientX - startPan.x; camera.y = e.clientY - startPan.y; redrawCanvas(); return; }
    const coords = screenToGrid(e.clientX, e.clientY);
    if (coords.x >= 0 && coords.x < MAP_WIDTH && coords.y >= 0 && coords.y < MAP_HEIGHT) {
        const hX = document.getElementById('hudX'); const hY = document.getElementById('hudY');
        if (hX) hX.innerText = coords.x; if (hY) hY.innerText = coords.y;
        if (isMouseDown && continuousDrawMode) executeBrushPainting(coords.x, coords.y);
    }
});

// ПОВНІСТЮ ЗАКРИТИЙ ТА ВИПРАВЛЕНИЙ НАЙКРИТИЧНІШИЙ ОБРОБНИК КЛІКУ
canvas.addEventListener('mousedown', (e) => {
    initAudio();
    if (!window.currentUser) return; 
    if (e.button === 1 || e.button === 2) { 
        isDragging = true; 
        startPan.x = e.clientX - camera.x; 
        startPan.y = e.clientY - camera.y; 
        e.preventDefault(); 
        return; 
    }
    if (e.button === 0) {
        isMouseDown = true; 
        const coords = screenToGrid(e.clientX, e.clientY);
        if (coords.x >= 0 && coords.x < MAP_WIDTH && coords.y >= 0 && coords.y < MAP_HEIGHT) {
            if (e.ctrlKey) { 
                e.preventDefault(); 
                let key = coords.x + '_' + coords.y;
                let clickedCode = (window.mapData && window.mapData[key]) ? window.mapData[key] : "zzz"; 
                if(palette[clickedCode]) {
                    picker.value = palette[clickedCode].hex; 
                    picker.dispatchEvent(new Event('input')); 
                }
                return; 
            }
            executeBrushPainting(coords.x, coords.y);
        }
    }
});

window.addEventListener('mouseup', () => { isDragging = false; isMouseDown = false; });

canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); const rect = canvas.getBoundingClientRect();
    let mX = e.clientX - rect.left, mY = e.clientY - rect.top;
    let gridX = (mX - camera.x) / zoom, gridY = (mY - camera.y) / zoom;
    zoom = (e.deltaY < 0) ? Math.min(maxZoom, zoom * 1.2) : Math.max(minZoom, zoom / 1.2);
    camera.x = mX - gridX * zoom; camera.y = mY - gridY * zoom;
    document.getElementById('hudZoom').innerText = Math.round(zoom * 100) + "%"; redrawCanvas();
});

document.getElementById('gridCheckbox').addEventListener('change', (e) => { showGrid = e.target.checked; redrawCanvas(); });
document.getElementById('volumeSlider').addEventListener('input', (e) => { soundVolume = e.target.value / 100; });

window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
        e.preventDefault(); continuousDrawMode = !continuousDrawMode;
        const statusEl = document.getElementById('brushStatus');
        if (continuousDrawMode) { statusEl.innerText = "Пензель (Затискання)"; statusEl.className = "status-on"; }
        else { statusEl.innerText = "Крапка (Кліки)"; statusEl.className = "status-off"; }
    }
});

document.getElementById('resetMapBtn').addEventListener('click', () => {
    if(confirm("Очистити всю карту?")) firebase.database().ref('multiplayer_map').remove();
});

window.addEventListener('resize', () => { canvas.width = container.clientWidth; canvas.height = container.clientHeight; redrawCanvas(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

if (picker) { picker.value = "#ff0000"; picker.dispatchEvent(new Event('input')); }
drawFormulaGraph();
setTimeout(redrawCanvas, 600);
