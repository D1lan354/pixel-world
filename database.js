// Конфігурація твого проєкту Firebase
const firebaseConfig = {
  apiKey: "AIzaSyArIgEB93kQ_2xfJAjkvGuKVhYqwoKpB54",
  authDomain: "pixel-world-db.firebaseapp.com",
  databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com",
  projectId: "pixel-world-db",
  storageBucket: "pixel-world-db.firebasestorage.app",
  messagingSenderId: "987006631539",
  appId: "1:987006631539:web:8f8b732de1d26fa2ce3406"
};

// Запуск зв'язку з Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const mapRef = db.ref('multiplayer_map');

// Створюємо глобальну змінну, яку бачитиме файл player.js
window.mapData = {};

// Головний слухач онлайну: коли хтось ставить піксель, Firebase миттєво оновлює карту у всіх
mapRef.on('value', (snapshot) => {
    window.mapData = snapshot.val() || {};
    // Примусово викликаємо функцію малювання з файлу player.js
    if (typeof window.redrawCanvas === "function") {
        window.redrawCanvas();
    }
});

// Функція, яка закидає твій клік в інтернет
function sendPixel(x, y, colorCode) {
    let key = x + '_' + y;
    db.ref('multiplayer_map/' + key).set(colorCode);
}
