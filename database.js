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

// Глобальний слухач авторизації
auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('authScreen');
    const hudUser = document.getElementById('hudUser');
    
    if (user) {
        if(authScreen) authScreen.style.display = 'none';
        window.currentUser = user;
        
        // Витягуємо збережений нікнейм з Firebase Database
        db.ref('users/' + user.uid).once('value').then((snapshot) => {
            let userData = snapshot.val();
            if (userData && userData.nickname) {
                if(hudUser) hudUser.innerText = userData.nickname;
            } else {
                if(hudUser) hudUser.innerText = user.email.split('@')[0];
            }
        });
    } else {
        if(authScreen) authScreen.style.display = 'flex';
        if(hudUser) hudUser.innerText = '—';
        window.currentUser = null;
    }
    if (typeof window.redrawCanvas === "function") window.redrawCanvas();
});

// Реєстрація з нікнеймом
function handleRegister() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const nickname = document.getElementById('authNickname').value.trim();
    
    if(!email || !password || !nickname) return alert("Заповни ВСІ поля включаючи Нікнейм!");
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Зберігаємо нікнейм у базі даних, прив'язуючи до UID акаунта
            return db.ref('users/' + userCredential.user.uid).set({
                nickname: nickname,
                email: email
            });
        })
        .then(() => { alert("Реєстрація успішна!"); })
        .catch((error) => { alert("Помилка реєстрації: " + error.message); });
}

// Вхід за Email
function handleLogin() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if(!email || !password) return alert("Введи пошту і пароль!");
    
    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => { alert("Помилка входу: " + error.message); });
}

// Залізобетонний вихід
function handleLogout() {
    auth.signOut().then(() => {
        document.getElementById('authEmail').value = "";
        document.getElementById('authPassword').value = "";
        document.getElementById('authNickname').value = "";
    }).catch((err) => { console.error("Помилка при виході:", err); });
}

// Синхронізація карти
mapRef.on('value', (snapshot) => {
    window.mapData = snapshot.val() || {};
    if (typeof window.redrawCanvas === "function") window.redrawCanvas();
});

// Розумна функція відправки: перевіряє чи змінився колір перед записом!
function sendPixel(x, y, colorCode) {
    if(!window.currentUser) return false;
    let key = x + '_' + y;
    
    // Якщо клітинка вже розмальована цим кольором — ігноруємо клік
    if (window.mapData && window.mapData[key] === colorCode) {
        return false; 
    }
    
    db.ref('multiplayer_map/' + key).set(colorCode);
    return true; // Повертає true, якщо піксель реально оновився
}
