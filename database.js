const firebaseConfig = {
  apiKey: "AIzaSyArIgEB93kQ_2xfJAjkvGuKVhYqwoKpB54",
  authDomain: "pixel-world-db.firebaseapp.com",
  databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com",
  projectId: "pixel-world-db",
  storageBucket: "pixel-world-db.firebasestorage.app",
  messagingSenderId: "987006631539",
  appId: "1:987006631539:web:8f8b732de1d26fa2ce3406"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const mapRef = db.ref('multiplayer_map');

// Робимо масив глобальним
window.mapData = {};

// Слухаємо базу в реальному часі
mapRef.on('value', (snapshot) => {
    window.mapData = snapshot.val() || {};
    // Викликаємо перемальовування екрану
    if (typeof window.redrawCanvas === "function") {
        window.redrawCanvas();
    }
});

function sendPixel(x, y, colorCode) {
    let key = x + '_' + y;
    db.ref('multiplayer_map/' + key).set(colorCode);
}
