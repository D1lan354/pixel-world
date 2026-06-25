// Конфігурація Firebase
const firebaseConfig = {
  apiKey: "AIzaSyArIgEB93kQ_2xfJAjkvGuKVhYqwoKpB54",
  authDomain: "pixel-world-db.firebaseapp.com",
  databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com",
  projectId: "pixel-world-db",
  storageBucket: "pixel-world-db.firebasestorage.app",
  messagingSenderId: "987006631539",
  appId: "1:987006631539:web:8f8b732de1d26fa2ce3406"
};

// Перевіряємо, чи ініціалізовано Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const mapRef = db.ref('multiplayer_map');

// СЛУХАЄМО БАЗУ В РЕАЛЬНОМУ ЧАСІ (ДЛЯ ОНОВЛЕННЯ У ВСІХ ГРАВЦІВ)
mapRef.on('value', (snapshot) => {
    // Оновлюємо глобальний об'єкт мапи новими даними з сервера
    window.mapData = snapshot.val() || {};
    
    // Якщо функція малювання вже завантажилась у player.js — примусово перемальовуємо
    if (typeof window.redrawCanvas === "function") {
        window.redrawCanvas();
    } else if (typeof redrawCanvas === "function") {
        redrawCanvas();
    }
}, (error) => {
    console.error("Помилка синхронізації Firebase:", error);
});

// ФУНКЦІЯ ВІДПРАВКИ ПІКСЕЛЯ
function sendPixel(x, y, colorCode) {
    let key = x + '_' + y;
    db.ref('multiplayer_map/' + key).set(colorCode)
      .catch((err) => console.error("Помилка запису:", err));
}
