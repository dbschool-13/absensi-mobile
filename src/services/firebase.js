import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Ganti dengan konfigurasi Firebase dari console Anda
const firebaseConfig = {
  apiKey: "AIzaSyAzg1pn-htjMqcFf6iFCgGsP4gtMF-zNMg",
  authDomain: "db-absensipro.firebaseapp.com",
  projectId: "db-absensipro",
  storageBucket: "db-absensipro.firebasestorage.app",
  messagingSenderId: "610059995772",
  appId: "1:610059995772:web:38e831ff15b9928e5797f9",
  measurementId: "G-6DXE02DQHS",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore
export const db = getFirestore(app);
