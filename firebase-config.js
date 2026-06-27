import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 👇 ЗАМІНИ НА СВОЇ ДАНІ З FIREBASE CONSOLE → Project Settings → Your apps
const firebaseConfig = {
  apiKey: "ТВІЙ_API_KEY",
  authDomain: "ТВІЙ_PROJECT.firebaseapp.com",
  projectId: "ТВІЙ_PROJECT_ID",
  storageBucket: "ТВІЙ_PROJECT.appspot.com",
  messagingSenderId: "ТВІЙ_SENDER_ID",
  appId: "ТВІЙ_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
