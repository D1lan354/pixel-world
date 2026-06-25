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

// Автоматично стежимо: зайшов користувач чи вийшов
auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('authScreen');
    const hudUser = document.getElementById('hudUser');
    
    if (user) {
        // Користувач увійшов
        if(authScreen) authScreen.style.display = 'none';
        if(hudUser) hudUser.innerText = user.email;
        window.currentUser = user;
    } else {
        // Користувач не авторизований
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
    if(!email || !password) return alert("Заповни всі поля!");
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => { alert("Реєстрація успішна!"); })
        .catch((error) => { alert("Помилка реєстрації: " + error.message); });
}

// ФУНКЦІЯ ВХОДУ
function handleLogin() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if(!email || !password) return alert("Заповни всі поля!");
    
    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => { alert("Помилка входу: " + error.message); });
}

// ФУНКЦІЯ ВИХОДУ
function handleLogout() {
    auth.signOut();
}

// Синхронізація малювання в реальному часі
mapRef.on('value', (snapshot) => {
    window.mapData = snapshot.val() || {};
    if (typeof window.redrawCanvas === "function") {
        window.redrawCanvas();
    }
});

function sendPixel(x, y, colorCode) {
    if(!window.currentUser) return; // Гості не можуть малювати
    let key = x + '_' + y;
    db.ref('multiplayer_map/' + key).set(colorCode);
}
