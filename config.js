// ==========================================
// Firebase Configuration
// دلوقتي ماركت
// ==========================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// ==========================================
// Firebase Project
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyCbPdwAucolmn1ZXh2x00qE8CNQz9V4bD8",
  authDomain: "delwaty-market-5399a.firebaseapp.com",
  projectId: "delwaty-market-5399a",
  storageBucket: "delwaty-market-5399a.firebasestorage.app",
  messagingSenderId: "779111774247",
  appId: "1:779111774247:web:3cd244864a265e6e28b602"
};


// ==========================================
// Initialize Firebase
// ==========================================

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);


// ==========================================
// HTML Escape
// حماية النصوص قبل عرضها داخل HTML
// ==========================================

const esc = value => {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
};


// ==========================================
// Get Staff Role
// الحصول على صلاحية المستخدم
// ==========================================

async function getRole(user) {

  if (!user) {
    return null;
  }

  try {

    const staffRef = doc(
      db,
      "staff",
      user.uid
    );

    const snapshot = await getDoc(staffRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return data?.role || null;

  } catch (error) {

    console.error(
      "Error loading staff role:",
      error
    );

    return null;
  }
}


// ==========================================
// Firebase Exports
// ==========================================

export {

  // ----------------------------------------
  // Firebase instances
  // ----------------------------------------
  app,
  db,
  auth,

  // ----------------------------------------
  // Helpers
  // ----------------------------------------
  esc,
  getRole,

  // ----------------------------------------
  // Firestore
  // ----------------------------------------
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,

  // ----------------------------------------
  // Authentication
  // ----------------------------------------
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut

};
