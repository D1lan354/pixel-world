const firebaseConfig = {
  apiKey: "AIzaSyArIgEB93kQ_2xfJAjkvGuKVhYqwoKpB54",
  authDomain: "pixel-world-db.firebaseapp.com",
  databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com",
  projectId: "pixel-world-db",
  storageBucket: "pixel-world-db.firebasestorage.app",
  messagingSenderId: "987006631539",
  appId: "1:987006631539:web:8f8b732de1d26fa2ce3406"
};

// Запускаємо зв'язок з серверами
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const mapRef = db.ref('multiplayer_map');

let mapData = {};

// Слухаємо онлайн базу: коли міняється хоч один піксель — перемальовуємо мапу
mapRef.on('value', (snapshot) => {
    mapData = snapshot.val() || {};
    if (typeof redrawCanvas === "function") {
        redrawCanvas();
    }
});

// Функція відправки пікселя на сервер Google
function sendPixel(x, y, colorCode) {
    let key = x + '_' + y;
    db.ref('multiplayer_map/' + key).set(colorCode);
}
