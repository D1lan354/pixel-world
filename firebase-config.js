import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
 
// 👇 ЗАМІНИ НА СВОЇ ЗНАЧЕННЯ
const firebaseConfig = {
  apiKey: "AIzaSyDCKmkm7PeB2s2xJ0RLJKRmOLK9kThrAvY",
  authDomain: "pixeledworld.firebaseapp.com",
  databaseURL: "https://pixeledworld-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pixeledworld",
  storageBucket: "pixeledworld.firebasestorage.app",
  messagingSenderId: "862353757400",
  appId: "1:862353757400:web:2cfd449f93a9fc3eac73ad",
  measurementId: "G-R05NR5YMQ6"
};
 
const app = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
 
