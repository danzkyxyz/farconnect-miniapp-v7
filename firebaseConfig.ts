// miniapp-frontend/firebaseConfig.ts

import { initializeApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// Konfigurasi Firebase dari input Anda
const firebaseConfig = {
  apiKey: "AIzaSyAyyk0vaMizjR3ozNcBj9kCzsRWLcHPEBc",
  authDomain: "farconnect-db.firebaseapp.com",
  projectId: "farconnect-db",
  storageBucket: "farconnect-db.firebasestorage.app",
  messagingSenderId: "708347163160",
  appId: "1:708347163160:web:786c55d74fc0240ec7896d",
  measurementId: "G-TXKEEG1VJJ"
};

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore
const db: Firestore = getFirestore(app);

// Export db agar bisa digunakan di MiniApp
export { db };