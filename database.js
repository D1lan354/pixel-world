// Конфігурація з твого скріншоту
const firebaseConfig = {
  apiKey: "AIzaSyArIgEB93kQ_2xfJAjkvGuKVhYqwoKpB54",
  authDomain: "pixel-world-db.firebaseapp.com",
  projectId: "pixel-world-db",
  storageBucket: "pixel-world-db.firebasestorage.app",
  messagingSenderId: "987006631539",
  appId: "1:987006631539:web:8f8b732de1d26fa2ce3406"
};

// Ініціалізація
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const mapRef = db.ref('multiplayer_map');

// Сюди записуються всі пікселі світу
let mapData = {};

// Слухаємо базу даних: як тільки хтось (ти чи друг) клікне — мапа оновиться у всіх
mapRef.on('value', (snapshot) => {
    mapData = snapshot.val() || {};
    if (typeof redrawCanvas === "function") {
        redrawCanvas(); // Викликаємо малювання з іншого файлу
    }
});

// Функція для надсилання кліку в онлайн
function sendPixel(x, y, colorCode) {
    let key = x + '_' + y;
    mapRef.child(key).set(colorCode);
}
