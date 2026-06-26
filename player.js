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

// Змінні кулдауну
let cooldownTime = 0.0; // Поточний перегрів у секундах
const MAX_COOLDOWN = 300.0; // 5 хвилин
let isCooldownBlocked = false;

let soundSettings = {
    click: { wave: 'sine', freq: 400, duration: 0.15, filter: 8000, formula: "Math.sin(t * 0.05) * Math.exp(-t * 0.02)" },
    pipette: { wave: 'triangle', freq: 800, duration: 0.15, filter: 8000, formula: "Math.sin(t * 0.1) * Math.exp(-t * 0.05)" },
    switch: { wave: 'square', freq: 500, duration: 0.10, filter: 8000, formula: "0.2 * Math.sin(t * 0.03) * Math.exp(-t * 0.01)" }
};

function changeTheme(theme) {
    document.body.className = "";
    if(theme !== 'dark') document.body.classList.add('theme-' + theme);
}
window.changeTheme = changeTheme;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.connect(audioCtx.destination);
        drawLiveVisualizer();
        drawFormulaGraph();
    }
}

function playSoundFX(type) {
    initAudio(); 
    // Зчитуємо актуальне значення гучності безпосередньо перед програванням
    soundVolume = parseInt(document.getElementById('volumeSlider').value) / 100;
    if (soundVolume === 0) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const cfg = soundSettings[type];
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const biquadFilter = audioCtx.createBiquadFilter();
        
        oscillator.type = cfg.wave;
        oscillator.frequency.setValueAtTime(cfg.freq, audioCtx.currentTime);
        biquadFilter.type = "lowpass";
        biquadFilter.frequency.setValueAtTime(cfg.filter, audioCtx.currentTime);

        oscillator.connect(gainNode); gainNode.connect(biquadFilter); biquadFilter.connect(analyserNode);
        
        let duration = cfg.duration, sampleRate = 100;
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        for (let t = 0; t < sampleRate; t++) {
            let timeOffset = (t / sampleRate) * duration;
            let volumeMod = eval(cfg.formula);
            if(isNaN(volumeMod) || volumeMod < 0) volumeMod = 0;
            gainNode.gain.linearRampToValueAtTime(volumeMod * soundVolume * 0.2, audioCtx.currentTime + timeOffset);
        }
        oscillator.start(); oscillator.stop(audioCtx.currentTime + duration);
    } catch(e) {}
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
    let currentFormula = soundSettings.click.formula, sampleRate = 100;
    for (let t = 0; t < sampleRate; t++) {
        let volumeMod = 0; try { volumeMod = eval(currentFormula); if (isNaN(volumeMod)) volumeMod = 0; } catch (e) { volumeMod = 0; }
        let x = (t / sampleRate) * fCanvas.width;
        let y = fCanvas.height / 2 - (volumeMod * (fCanvas.height * 0.4));
        if (t === 0) fCtx.moveTo(x, y); else fCtx.lineTo(x, y);
    }
    fCtx.stroke();
}

// Щосекундне зменшення кулдауну
setInterval(() => {
    if (cooldownTime > 0) {
        cooldownTime -= 1.0;
        if (cooldownTime < 0) cooldownTime = 0;
    }
    if (isCooldownBlocked && cooldownTime === 0) {
        isCooldownBlocked = false;
        document.getElementById('cooldownTimer').classList.remove('cooldown-blocked');
    }
    updateCooldownUI();
}, 1000);

function updateCooldownUI() {
    const timerText = document.getElementById('cooldownTimer');
    const bar = document.getElementById('cooldownBar');
    
    timerText.innerText = cooldownTime.toFixed(1) + "с";
    let percentage = (cooldownTime / MAX_COOLDOWN) * 100;
    bar.style.width = Math.min(100, percentage) + "%";
    
    if (isCooldownBlocked) {
        bar.style.backgroundColor = '#ff4444';
    } else {
        bar.style.backgroundColor = percentage > 75 ? '#ffaa00' : '#00ff00';
    }
}

// Розрахунок малювання сітки пікселів (1х1, 3х3, 5х5)
function drawPixelBrush(baseX, baseY) {
    if (isCooldownBlocked || !window.currentUser) return;
    
    const size = parseInt(document.getElementById('brushSizeSelector').value);
    let offset = Math.floor(size / 2);
    let anyPixelPainted = false;

    for (let dx = -offset; dx <= offset; dx++) {
        for (let dy = -offset; dy <= offset; dy++) {
            let tx = baseX + dx;
            let ty = baseY + dy;
            
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                let success = sendPixel(tx, ty, selectedCode);
                if (success) {
                    anyPixelPainted = true;
                    cooldownTime += 0.5; // Накидуємо +0.5 сек за кожен унікальний піксель
                }
            }
        }
    }

    if (anyPixelPainted) {
        playSoundFX('click');
        clickCount++;
        document.getElementById('hudClicks').innerText = clickCount;
        
        if (cooldownTime >= MAX_COOLDOWN) {
            cooldownTime = MAX_COOLDOWN;
            isCooldownBlocked = true;
            document.getElementById('cooldownTimer').classList.add('cooldown-blocked');
            alert("ПЕРЕГРІВ! Кулдаун дійшов до 5 хвилин. Чекай повного скидання до 0!");
        }
        updateCooldownUI();
    }
}

// Палітра
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
picker.addEventListener('input', (e) => {
    let nearest = findNearestColor(e.target.value);
    selectedGameColor = nearest.hex; selectedCode = nearest.code;
    document.getElementById('matchedColorBox').style.backgroundColor = nearest.hex;
    document.getElementById('colorCode').innerText = nearest.code;
});

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
        document.getElementById('hudX').innerText = coords.x; document.getElementById('hudY').innerText = coords.y;
        if (isMouseDown && continuousDrawMode) {
            drawPixelBrush(coords.x, coords.y);
        }
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (!window.currentUser) return; 
    if (e.button === 1 || e.button === 2) { isDragging = true; startPan.x = e.clientX - camera.x; startPan.y = e.clientY - camera.y; e.preventDefault(); return; }
    if (e.button === 0) {
        isMouseDown = true; const coords = screenToGrid(e.clientX, e.clientY);
        if (coords.x >= 0 && coords.x < MAP_WIDTH && coords.y >= 0 && coords.y < MAP_HEIGHT) {
            let key = coords.x + '_' + coords.y;
            if (e.ctrlKey) { 
                e.preventDefault(); 
                let clickedCode = (window.mapData && window.mapData[key]) ? window.mapData[key] : "zzz"; 
                picker.value = palette[clickedCode].hex; picker.dispatchEvent(new Event('input')); 
                playSoundFX('pipette'); return; 
            }
            drawPixelBrush(coords.x, coords.y);
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
        e.preventDefault(); continuousDrawMode = !continuousDrawMode; playSoundFX('switch');
        const statusEl = document.getElementById('brushStatus');
        if (continuousDrawMode) { statusEl.innerText = "Пензель (Затискання)"; statusEl.className = "status-on"; }
        else { statusEl.innerText = "Крапка (Кліки)"; statusEl.className = "status-off"; }
    }
});

document.getElementById('resetMapBtn').addEventListener('click', () => {
    if(confirm("Очистити абсолютно всю онлайн карту?")) { firebase.database().ref('multiplayer_map').remove(); }
});

window.addEventListener('resize', () => { canvas.width = container.clientWidth; canvas.height = container.clientHeight; redrawCanvas(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

picker.value = "#ff0000"; picker.dispatchEvent(new Event('input'));
setTimeout(redrawCanvas, 600);
