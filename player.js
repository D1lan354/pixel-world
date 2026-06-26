const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const vCanvas = document.getElementById('visualizerCanvas'); const vCtx = vCanvas ? vCanvas.getContext('2d') : null;
const fCanvas = document.getElementById('formulaCanvas'); const fCtx = fCanvas ? fCanvas.getContext('2d') : null;

function resizeCanvas() {
    if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        redrawCanvas();
    }
}
window.addEventListener('resize', resizeCanvas);

const MAP_WIDTH = 2048; const MAP_HEIGHT = 2048; const PIXEL_SIZE = 16; 

let zoom = 1.0, maxZoom = 15.0, minZoom = 0.01;
let camera = { x: 100, y: 100 };
let showGrid = true, soundVolume = 0.5, continuousDrawMode = false, isDragging = false, isMouseDown = false, startPan = { x: 0, y: 0 };
let audioCtx = null, analyserNode = null;
let clickCount = 0;

let cooldownTime = parseFloat(localStorage.getItem('pixel_cooldown')) || 0.0;
const MAX_COOLDOWN = 300.0;

let soundFormula = "Math.sin(t * 0.2) * Math.exp(-t * 0.04)";

// Генерація палітри
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

if (!window.mapData) window.mapData = {};

// НАДІЙНА ФУНКЦІЯ ВІДПРАВКИ ПІКСЕЛЯ З ПЕРЕВІРКОЮ НА ДУБЛІКАТ КОЛЬОРУ
function sendPixel(x, y, code) {
    // Жорсткий блок: якщо колір вже такий самий — виходимо і повертаємо false
    if (window.mapData[x + '_' + y] === code) {
        return false; 
    }

    window.mapData[x + '_' + y] = code;
    try {
        if (typeof firebase !== 'undefined' && firebase.database) {
            firebase.database().ref('multiplayer_map/' + x + '_' + y).set(code);
        }
    } catch(e) {}
    return true;
}

// Функція малювання карти
function redrawCanvas() {
    if (!ctx || !canvas) return;
    
    // Темно-сірий фон за межами полотна
    ctx.fillStyle = "#141414"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(camera.x, camera.y); ctx.scale(zoom, zoom);
    
    // ФОН КАРТИ ТЕПЕР ЧІТКО СВІТЛО-СІРИЙ (ЧУТЬ-ЧУТЬ СІРІШИЙ ЗА БІЛИЙ)
    ctx.fillStyle = "#ededed";
    ctx.fillRect(0, 0, MAP_WIDTH * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);
    
    // Червона рамка карти
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(0, 0, MAP_WIDTH * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE);

    // Контрастна сітка
    if (showGrid && zoom > 0.15) { 
        ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 0.5 / zoom; ctx.beginPath();
        for (let x = 0; x <= MAP_WIDTH; x += 4) { ctx.moveTo(x * PIXEL_SIZE, 0); ctx.lineTo(x * PIXEL_SIZE, MAP_HEIGHT * PIXEL_SIZE); }
        for (let y = 0; y <= MAP_HEIGHT; y += 4) { ctx.moveTo(0, y * PIXEL_SIZE); ctx.lineTo(MAP_WIDTH * PIXEL_SIZE, y * PIXEL_SIZE); }
        ctx.stroke();
    }

    // Відображення пікселів
    for (let key in window.mapData) {
        let coords = key.split('_');
        let x = parseInt(coords[0]), y = parseInt(coords[1]);
        let code = window.mapData[key];
        ctx.fillStyle = palette[code] ? palette[code].hex : "#ededed";
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
    ctx.restore();
}

// Логіка використання пензля
function executeBrushPainting(baseX, baseY) {
    if (cooldownTime >= MAX_COOLDOWN) return;
    
    const brushSelector = document.getElementById('brushSizeSelector');
    const size = brushSelector ? parseInt(brushSelector.value) : 1;
    let offset = Math.floor(size / 2);
    
    let actualPaintedCount = 0;

    for (let dx = -offset; dx <= offset; dx++) {
        for (let dy = -offset; dy <= offset; dy++) {
            let tx = baseX + dx;
            let ty = baseY + dy;
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                // Якщо піксель успішно пофарбовано (колір новий), додаємо до лічильника
                if (sendPixel(tx, ty, selectedCode)) {
                    actualPaintedCount++;
                }
            }
        }
    }

    // Нараховуємо кулдаун тільки за реальні зміни
    if (actualPaintedCount > 0) {
        playSoundFX();
        clickCount++;
        const clicksEl = document.getElementById('hudClicks');
        if (clicksEl) clicksEl.innerText = clickCount;
        
        // ТОЧНИЙ РОЗРАХУНОК: кожен новий піксель коштує 0.5с (5x5 = 25 пікселів * 0.5с = 12.5с)
        cooldownTime = Math.min(MAX_COOLDOWN, cooldownTime + (actualPaintedCount * 0.5));
        updateCooldownUI();
        redrawCanvas();
    }
}

// Інші обробники...
try {
    if (typeof firebase !== 'undefined' && firebase.database) {
        firebase.database().ref('multiplayer_map').on('value', (snapshot) => {
            window.mapData = snapshot.val() || {};
            redrawCanvas();
        });
    }
} catch(e) {}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (vCanvas && audioCtx) {
            analyserNode = audioCtx.createAnalyser();
            analyserNode.fftSize = 256;
            analyserNode.connect(audioCtx.destination);
            drawLiveVisualizer();
        }
    }
}

function playSoundFX() {
    initAudio(); 
    if (soundVolume === 0 || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const duration = 0.2;
        const sampleRate = audioCtx.sampleRate;
        const bufferSize = sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let waveFunction = new Function('t', `try { return ${soundFormula}; } catch(e) { return 0; }`);
        for (let i = 0; i < bufferSize; i++) {
            let t = (i / sampleRate) * 1000; 
            let sampleValue = waveFunction(t);
            if (isNaN(sampleValue)) sampleValue = 0;
            data[i] = Math.max(-1, Math.min(1, sampleValue * soundVolume * 0.5));
        }
        const bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = buffer;
        if (analyserNode) bufferSource.connect(analyserNode);
        else bufferSource.connect(audioCtx.destination);
        bufferSource.start();
    } catch(e) {}
}

function drawLiveVisualizer() {
    if (!vCanvas || !vCtx || !analyserNode) return;
    requestAnimationFrame(drawLiveVisualizer);
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteTimeDomainData(dataArray);
    vCtx.fillStyle = '#111'; vCtx.fillRect(0, 0, vCanvas.width, vCanvas.height);
    vCtx.lineWidth = 2; vCtx.strokeStyle = '#00ff00'; vCtx.beginPath();
    const sliceWidth = vCanvas.width / bufferLength; let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; const y = (v * vCanvas.height) / 2;
        if (i === 0) vCtx.moveTo(x, y); else vCtx.lineTo(x, y);
        x += sliceWidth;
    }
    vCtx.lineTo(vCanvas.width, vCanvas.height / 2); vCtx.stroke();
}

function drawFormulaGraph() {
    if (!fCanvas || !fCtx) return;
    fCtx.fillStyle = '#111'; fCtx.fillRect(0, 0, fCanvas.width, fCanvas.height);
    fCtx.strokeStyle = '#222'; fCtx.lineWidth = 1; fCtx.beginPath();
    fCtx.moveTo(0, fCanvas.height / 2); fCtx.lineTo(fCanvas.width, fCanvas.height / 2); fCtx.stroke();
    fCtx.strokeStyle = '#0088ff'; fCtx.lineWidth = 1.5; fCtx.beginPath();
    let sampleRate = 100;
    let waveFunction = new Function('t', `try { return ${soundFormula}; } catch(e) { return 0; }`);
    for (let t = 0; t < sampleRate; t++) {
        let val = waveFunction(t);
        if (isNaN(val)) val = 0;
        let x = (t / sampleRate) * fCanvas.width;
        let y = fCanvas.height / 2 - (val * (fCanvas.height * 0.4));
        if (t === 0) fCtx.moveTo(x, y); else fCtx.lineTo(x, y);
    }
    fCtx.stroke();
}

function findNearestColor(hexColor) {
    let r = parseInt(hexColor.slice(1, 3), 16), g = parseInt(hexColor.slice(3, 5), 16), b = parseInt(hexColor.slice(5, 7), 16);
    let minDistance = Infinity, nearestCode = "aaa", nearestHex = "#ff0000";
    for (let code in palette) {
        let p = palette[code]; let dist = Math.sqrt((r - p.r)**2 + (g - p.g)**2 + (b - p.b)**2);
        if (dist < minDistance) { minDistance = dist; nearestCode = code; nearestHex = p.hex; }
    }
    return { code: nearestCode, hex: nearestHex };
}

function screenToGrid(clientX, clientY) {
    if (!canvas) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    return { 
        x: Math.floor((clientX - rect.left - camera.x) / (PIXEL_SIZE * zoom)), 
        y: Math.floor((clientY - rect.top - camera.y) / (PIXEL_SIZE * zoom)) 
    };
}

const picker = document.getElementById('colorPicker');
if (picker) {
    picker.addEventListener('input', (e) => {
        let nearest = findNearestColor(e.target.value);
        selectedGameColor = nearest.hex; selectedCode = nearest.code;
        document.getElementById('matchedColorBox').style.backgroundColor = nearest.hex;
        document.getElementById('colorCode').innerText = nearest.code;
    });
}

if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
        initAudio();
        if (e.button === 1 || e.button === 2 || e.shiftKey) { 
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
                    let clickedCode = window.mapData[key] || "zzz"; 
                    if(palette[clickedCode] && picker) {
                        picker.value = palette[clickedCode].hex; 
                        picker.dispatchEvent(new Event('input')); 
                    }
                    return; 
                }
                executeBrushPainting(coords.x, coords.y);
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) { 
            camera.x = e.clientX - startPan.x; 
            camera.y = e.clientY - startPan.y; 
            redrawCanvas(); 
            return; 
        }
        const coords = screenToGrid(e.clientX, e.clientY);
        if (coords.x >= 0 && coords.x < MAP_WIDTH && coords.y >= 0 && coords.y < MAP_HEIGHT) {
            document.getElementById('hudX').innerText = coords.x; 
            document.getElementById('hudY').innerText = coords.y;
            if (isMouseDown && continuousDrawMode) {
                executeBrushPainting(coords.x, coords.y);
            }
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); const rect = canvas.getBoundingClientRect();
        let mX = e.clientX - rect.left, mY = e.clientY - rect.top;
        let gridX = (mX - camera.x) / zoom, gridY = (mY - camera.y) / zoom;
        zoom = (e.deltaY < 0) ? Math.min(maxZoom, zoom * 1.15) : Math.max(minZoom, zoom / 1.15);
        camera.x = mX - gridX * zoom; camera.y = mY - gridY * zoom;
        document.getElementById('hudZoom').innerText = Math.round(zoom * 100) + "%"; 
        redrawCanvas();
    });
}

window.addEventListener('mouseup', () => { isDragging = false; isMouseDown = false; });

function updateCooldownUI() {
    const timerText = document.getElementById('cooldownTimer');
    const bar = document.getElementById('cooldownBar');
    if(!timerText || !bar) return;
    timerText.innerText = cooldownTime.toFixed(1) + "с / 300с";
    bar.style.width = Math.min(100, (cooldownTime / MAX_COOLDOWN) * 100) + "%";
}

setInterval(() => {
    if (cooldownTime > 0) {
        cooldownTime = Math.max(0, cooldownTime - 1.0);
        localStorage.setItem('pixel_cooldown', cooldownTime);
        updateCooldownUI();
    }
}, 1000);

document.getElementById('gridCheckbox').addEventListener('change', (e) => { showGrid = e.target.checked; redrawCanvas(); });
document.getElementById('volumeSlider').addEventListener('input', (e) => { soundVolume = e.target.value / 100; });

window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
        continuousDrawMode = !continuousDrawMode;
        const statusEl = document.getElementById('brushStatus');
        if (continuousDrawMode) { statusEl.innerText = "Пензель (Затискання)"; statusEl.className = "status-on"; }
        else { statusEl.innerText = "Крапка (Кліки)"; statusEl.className = "status-off"; }
    }
});

document.getElementById('soundFormulaInput').addEventListener('input', (e) => {
    soundFormula = e.target.value;
    drawFormulaGraph();
});

document.getElementById('resetMapBtn').addEventListener('click', () => {
    if(confirm("Очистити всю карту?")) {
        try { if (typeof firebase !== 'undefined' && firebase.database) firebase.database().ref('multiplayer_map').remove(); } catch(e) {}
        window.mapData = {}; redrawCanvas();
    }
});

setTimeout(() => {
    resizeCanvas();
    drawFormulaGraph();
    if (picker) picker.dispatchEvent(new Event('input'));
}, 100);
