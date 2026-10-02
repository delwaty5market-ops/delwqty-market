import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, setDoc, deleteDoc,
  doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbPdwAucolmn1ZXh2x00qE8CNQz9V4bD8",
  authDomain: "delwaty-market-5399a.firebaseapp.com",
  projectId: "delwaty-market-5399a",
  storageBucket: "delwaty-market-5399a.firebasestorage.app",
  messagingSenderId: "779111774247",
  appId: "1:779111774247:web:3cd244864a265e6e28b602"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function getRole(user) {
  if (!user) return null;
  const s = await getDoc(doc(db, "staff", user.uid));
  return s.exists() ? s.data().role : null;
}

export {
  db, auth, esc, getRole, collection, addDoc, getDocs, getDoc, setDoc, deleteDoc,
  doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp,
  signInWithEmailAndPassword, onAuthStateChanged, signOut
};
