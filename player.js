const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const PIXEL_SIZE = 16;

// Функція малювання (яку автоматично смикає database.js при оновленні)
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Малюємо всі пікселі, які прилетіли з Firebase
    for (let key in mapData) {
        let coords = key.split('_');
        let x = parseInt(coords[0]);
        let y = parseInt(coords[1]);
        let code = mapData[key];
        
        // Малюємо піксель (якщо є палітра, колір береться з неї, інакше ставимо тимчасовий)
        ctx.fillStyle = (typeof palette !== 'undefined' && palette[code]) ? palette[code].hex : "#ff0000";
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
}

// Клік мишкою
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    let x = Math.floor((e.clientX - rect.left) / PIXEL_SIZE);
    let y = Math.floor((e.clientY - rect.top) / PIXEL_SIZE);
    
    // Визначаємо код кольору (якщо палітри немає — ставимо дефолтний 'aaa')
    let currentCode = (typeof selectedCode !== 'undefined') ? selectedCode : "aaa";
    
    // Відправляємо в базу даних!
    sendPixel(x, y, currentCode);
});
