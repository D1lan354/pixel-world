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
const auth = firebase.auth();
const mapRef = db.ref('multiplayer_map');

window.mapData = {};

// ГЛОБАЛЬНИЙ СЛУХАЧ СЕСІЇ КОРИСТУВАЧА
auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('authScreen');
    const hudUser = document.getElementById('hudUser');
    
    if (user) {
        // Користувач успішно увійшов
        if(authScreen) authScreen.style.display = 'none';
        if(hudUser) hudUser.innerText = user.email.split('@')[0]; // Показуємо логін до @gmail.com
        window.currentUser = user;
    } else {
        // Користувач вийшов або не авторизований
        if(authScreen) authScreen.style.display = 'flex';
        if(hudUser) hudUser.innerText = '—';
        window.currentUser = null;
    }
    if (typeof window.redrawCanvas === "function") window.redrawCanvas();
});

// ФУНКЦІЯ РЕЄСТРАЦІЇ
function handleRegister() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if(!email || !password) return alert("Заповни пошту і пароль!");
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => { alert("Реєстрація успішна! Ви увійшли."); })
        .catch((error) => { alert("Помилка реєстрації: " + error.message); });
}

// ФУНКЦІЯ ВХОДУ
function handleLogin() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if(!email || !password) return alert("Введи пошту і пароль!");
    
    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => { alert("Помилка входу: " + error.message); });
}

// ФУНКЦІЯ ВИХОДУ (Ось вона тепер залізобетонно працює!)
function handleLogout() {
    auth.signOut().then(() => {
        // Очищаємо поля вводу, щоб старі дані не стирчали
        document.getElementById('authEmail').value = "";
        document.getElementById('authPassword').value = "";
    }).catch((err) => {
        console.error("Помилка при виході:", err);
    });
}

// Реал-тайм синхронізація
mapRef.on('value', (snapshot) => {
    window.mapData = snapshot.val() || {};
    if (typeof window.redrawCanvas === "function") {
        window.redrawCanvas();
    }
});

function sendPixel(x, y, colorCode) {
    if(!window.currentUser) return; // Незалогінені не малюють
    let key = x + '_' + y;
    db.ref('multiplayer_map/' + key).set(colorCode);
}
