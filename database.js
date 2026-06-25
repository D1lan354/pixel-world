// Конфігурація Firebase зі скріншоту
const firebaseConfig = {
  apiKey: "AIzaSyArIgEB93kQ_2xfJAjkvGuKVhYqwoKpB54",
  authDomain: "pixel-world-db.firebaseapp.com",
  databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com",
  projectId: "pixel-world-db",
  storageBucket: "pixel-world-db.firebasestorage.app",
  messagingSenderId: "987006631539",
  appId: "1:987006631539:web:8f8b732de1d26fa2ce3406"
};

// Ініціалізація
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const mapRef = db.ref('multiplayer_map');

let mapData = {};

// Слухаємо базу даних в реальному часі
mapRef.on('value', (snapshot) => {
    mapData = snapshot.val() || {};
    if (typeof redrawCanvas === "function") {
        redrawCanvas();
    }
}, (error) => {
    console.error("Помилка читання бази Firebase:", error);
});

// Функція відправки пікселя на сервер
function sendPixel(x, y, colorCode) {
    let key = x + '_' + y;
    db.ref('multiplayer_map/' + key).set(colorCode)
      .catch((err) => console.error("Помилка запису в Firebase:", err));
}
