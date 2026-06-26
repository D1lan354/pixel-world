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

// Розумне малювання пензлем: якщо ліміт близько, вибирає випадкові пікселі, які ще "влізуть"
function executeBrushPainting(baseX, baseY) {
    if (cooldownTime >= MAX_COOLDOWN || !window.currentUser) return;
    
    const brushSelector = document.getElementById('brushSizeSelector');
    const size = brushSelector ? parseInt(brushSelector.value) : 1;
    let offset = Math.floor(size / 2);
    
    let pixelsToPaint = [];

    // 1. Збираємо всі координати з області пензля
    for (let dx =
