// ============================================================
// КРОК 1: Іди на https://console.firebase.google.com
// КРОК 2: "Add project" → дай назву → Continue
// КРОК 3: У лівому меню: Build → Firestore Database → Create database
//         Вибери "Start in test mode" (для розробки)
// КРОК 4: Build → Authentication → Get started → Email/Password → Enable
// КРОК 5: Project Settings (шестерня) → Your apps → "</>" (Web)
//         Зареєструй додаток, скопіюй firebaseConfig нижче
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 👇 ЗАМІНИ ЦІ ЗНАЧЕННЯ НА СВОЇ З FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDCKmkm7PeB2s2xJ0RLJKRmOLK9kThrAvY",
  authDomain: "pixeledworld.firebaseapp.com",
  projectId: "pixeledworld",
  storageBucket: "pixeledworld.firebasestorage.app",
  messagingSenderId: "862353757400",
  appId: "1:862353757400:web:2cfd449f93a9fc3eac73ad",
  measurementId: "G-R05NR5YMQ6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
