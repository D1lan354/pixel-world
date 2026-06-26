const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const vCanvas = document.getElementById('visualizerCanvas'); const vCtx = vCanvas.getContext('2d');
const fCanvas = document.getElementById('formulaCanvas'); const fCtx = fCanvas.getContext('2d');

canvas.width = container.clientWidth; canvas.height = container.clientHeight;

const MAP_WIDTH = 2048; const MAP_HEIGHT = 2048; const PIXEL_SIZE = 16; 

let zoom = 1.0, maxZoom = 15.0, minZoom = 0.01;
let camera = { x: canvas.width/2 - 500, y: canvas.height/2 - 500 };
let showGrid = true, soundVolume = 0.5, continuousDrawMode = false, isDragging = false, isMouseDown = false, startPan = { x: 0, y: 0 };
let audioCtx = null, analyserNode = null;
let clickCount = 0;

// Логіка кулдауну
let cooldownTime = parseFloat(localStorage.getItem('pixel_cooldown')) || 0.0;
const MAX_COOLDOWN = 300.0;

// Змінна для текстового коду звуку
let soundFormula = "Math.sin(t * 0.2) * Math.exp(-t * 0.04)";

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.connect(audioCtx.destination);
        drawLiveVisualizer();
    }
}

// Живий генератор звуку з формули
function playSoundFX() {
    initAudio(); 
    const volumeInput = document.getElementById('volumeSlider');
    soundVolume = volumeInput ? (parseInt(volumeInput.value) / 100) : 0.5;
    if (soundVolume === 0) return;

    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const duration = 0.18;
        const sampleRate = audioCtx.sampleRate;
        const bufferSize = sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);

        // Перетворення тексту у функцію
        let waveFunction = new Function('t', `try { return ${soundFormula}; } catch(e) { return 0; }`);

        for (let i = 0; i < bufferSize; i++) {
            let t = (i / sampleRate) * 1000; 
            let sampleValue = waveFunction(t);
            if (isNaN(sampleValue)) sampleValue = 0;
            data[i] = Math.max(-1, Math.min(1, sampleValue * soundVolume * 0.4));
        }

        const bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = buffer;
        
        const biquadFilter = audioCtx.createBiquadFilter();
        biquadFilter.type = "lowpass";
        biquadFilter.frequency.setValueAtTime(7000, audioCtx.currentTime);

        bufferSource.connect(biquadFilter);
        biquadFilter.connect(analyserNode);
        
        bufferSource.start();
    } catch(e) {
        console.error(e);
    }
}

function drawLiveVisualizer() {
    requestAnimationFrame(drawLiveVisualizer);
    if(!analyserNode) return;
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
    fCtx.fillStyle = '#111'; fCtx.fillRect(0, 0, fCanvas.width, fCanvas.height);
    fCtx.strokeStyle = '#333'; fCtx.lineWidth = 1; fCtx.beginPath();
    fCtx.moveTo(0, fCanvas.height / 2); fCtx.lineTo(fCanvas.width, fCanvas.height / 2); fCtx.stroke();
    fCtx.strokeStyle = '#0088ff'; fCtx.lineWidth = 2; fCtx.beginPath();
    
    let sampleRate = 100;
    let waveFunction = new Function('t', `try { return ${soundFormula}; } catch(e) { return 0; }`);
    
    for (let t = 0; t < sampleRate; t++) {
        let volumeMod = waveFunction(t);
        if (isNaN(volumeMod)) volumeMod = 0;
        let x = (t / sampleRate) * fCanvas.width;
        let y = fCanvas.height / 2 - (volumeMod * (fCanvas.height * 0.4));
        if (t === 0) fCtx.moveTo(x, y); else fCtx.lineTo(x, y);
    }
    fCtx.stroke();
}

// Функція оновлення коду звуку (викликається з інпуту)
window.updateAudioFormula = function(newFormula) {
    soundFormula = newFormula;
    drawFormulaGraph();
};

// Щосекундне охолодження
setInterval(() => {
    if (cooldownTime > 0) {
        cooldownTime -= 1.0;
        if (cooldownTime < 0) cooldownTime = 0;
        localStorage.setItem('pixel_cooldown', cooldownTime);
    }
    updateCooldownUI();
}, 1000);

function updateCooldownUI() {
    const timerText = document.getElementById('cooldownTimer');
    const bar = document.getElementById('cooldownBar');
    if(!timerText || !bar) return;

    timerText.innerText = cooldownTime.toFixed(1) + "с";
    let percentage = (cooldownTime / MAX_COOLDOWN) * 100;
    bar.style.width = Math.min(100, percentage) + "%";
    
    if (cooldownTime >= MAX_COOLDOWN) {
        bar.style.backgroundColor = '#ff4444';
        timerText.style.color = '#ff4444';
    } else {
        bar.style.backgroundColor = percentage > 75 ? '#ffaa00' : '#00ff00';
        timerText.style.color = '#fff';
    }
}

// Розумне малювання великим пензлем: зупиняється на 300с миттєво
function executeBrushPainting(baseX, baseY) {
    if (cooldownTime >= MAX_COOLDOWN || !window.currentUser) return;
    
    const brushSelector = document.getElementById('brushSizeSelector');
    const size = brushSelector ? parseInt(brushSelector.value) : 1;
    let offset = Math.floor(size / 2);
    
    let pixelsToPaint = [];

    for (let dx = -offset; dx <= offset; dx++) {
        for (let dy = -offset; dy <= offset; dy++) {
            let tx = baseX + dx;
            let ty = baseY + dy;
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                pixelsToPaint.push({x: tx, y: ty});
            }
        }
    }

    let delay = 0;
    let anyPixelPainted = false;

    pixelsToPaint.forEach((pixel) => {
        // Якщо під час циклу таймер вдарив у 300 — наступні з 25 пікселів малюватися НЕ будуть
        if (cooldownTime >= MAX_COOLDOWN) return;

        setTimeout(() => {
            if (cooldownTime >= MAX_COOLDOWN) return;
            
            let success = sendPixel(pixel.x, pixel.y, selectedCode);
            if (success) {
                anyPixelPainted = true;
                cooldownTime += 0.8; // Додаємо нагрів за піксель
                if (cooldownTime > MAX_COOLDOWN) cooldownTime = MAX_COOLDOWN;
                localStorage.setItem('pixel_cooldown', cooldownTime);
                updateCooldownUI();
            }
        }, delay);
        
        delay += 15; // Інтервал проти спаму бази
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

// Альфа-палітра
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

canvas.addEventListener('mousedown', (e) => {
    initAudio();
    if (!window.currentUser) return; 
    if (e.button === 1 || e.button === 2) { isDragging = true; startPan.x = e.clientX - camera.x; startPan.y = e.clientY - camera.y; e.preventDefault(); return; }
    if (e.button === 0) {
        isMouseDown = true; const coords = screenToGrid(e.clientX, e.clientY);
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
