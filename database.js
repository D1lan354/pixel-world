const firebaseConfig = {
  apiKey: "AIzaSyArIgEB93kQ_2xfJAjkvGuKVhYqwoKpB54",
  authDomain: "pixel-world-db.firebaseapp.com",
  databaseURL: "https://pixel-world-db-default-rtdb.firebaseio.com",
  projectId: "pixel-world-db",
  storageBucket: "pixel-world-db.firebasestorage.app",
  messagingSenderId: "987006631539",
  appId: "1:987006631539:web:8f8b732de1d26fa2ce3406"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const mapRef = db.ref('multiplayer_map');

window.mapData = {};

auth.onAuthStateChanged((user) => {
    const authScreen = document.getElementById('authScreen');
    const hudUser = document.getElementById('hudUser');
    
    if (user) {
        if(authScreen) authScreen.style.display = 'none';
        window.currentUser = user;
        
        db.ref('users/' + user.uid).once('value').then((snapshot) => {
            let userData = snapshot.val();
            if (hudUser) {
                hudUser.innerText = (userData && userData.nickname) ? userData.nickname : user.email.split('@')[0];
            }
        });
    } else {
        if(authScreen) authScreen.style.display = 'flex';
        if(hudUser) hudUser.innerText = '—';
        window.currentUser = null;
    }
    if (typeof window.redrawCanvas === "function") window.redrawCanvas();
});

function handleRegister() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const nickname = document.getElementById('authNickname').value.trim();
    if(!email || !password || !nickname) return alert("Заповни всі поля!");
    auth.createUserWithEmailAndPassword(email, password).then((cred) => {
        return db.ref('users/' + cred.user.uid).set({ nickname: nickname, email: email });
    }).catch(err => alert(err.message));
}

function handleLogin() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    if(!email || !password) return alert("Введи дані!");
    auth.signInWithEmailAndPassword(email, password).catch(err => alert(err.message));
}

function handleLogout() {
    auth.signOut().then(() => {
        localStorage.removeItem('pixel_cooldown'); // Очищуємо локальний кулдаун при виході
        window.location.reload();
    });
}

mapRef.on('value', (snapshot) => {
    window.mapData = snapshot.val() || {};
    if (typeof window.redrawCanvas === "function") window.redrawCanvas();
});

// Замість sendPixel(x, y, color)
function sendPixel(x, y, colorCode) {
    // Firebase створить гілки: multiplayer_map -> [y] -> [x] -> колір
    db.ref('multiplayer_map/' + y + '/' + x).set(colorCode);
}
