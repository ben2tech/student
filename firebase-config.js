// firebase-config.js — Firebase Initialization (Modular v9+)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyDuRDNQMJ46BC3Hhpq65CKsE1QepLk-Rfk",
  authDomain: "student-d7865.firebaseapp.com",
  projectId: "student-d7865",
  storageBucket: "student-d7865.firebasestorage.app",
  messagingSenderId: "776316970579",
  appId: "1:776316970579:web:599a65cd85a3be8a57c8a6",
  measurementId: "G-P7WTBSZ635"
};

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
