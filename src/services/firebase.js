import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Konfigurasi Firebase dari console Anda
const firebaseConfig = {
  apiKey: "AIzaSyAzg1pn-htjMqcFf6iFCgGsP4gtMF-zNMg",
  authDomain: "db-absensipro.firebaseapp.com",
  projectId: "db-absensipro",
  storageBucket: "db-absensipro.firebasestorage.app",
  messagingSenderId: "610059995772",
  appId: "1:610059995772:web:38e831ff15b9928e5797f9",
  measurementId: "G-6DXE02DQHS",
};

// 1. Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// 2. Inisialisasi Cloud Firestore DENGAN FITUR CACHE LOKAL (OPTIMALISASI KUOTA)
// Ini akan membuat browser menyimpan data yang pernah ditarik. 
// Jika guru merefresh halaman, aplikasi akan membaca dari memori HP, bukan menagih kuota ke server Google.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ 
    tabManager: persistentMultipleTabManager() 
  })
});

// 3. Initialize Storage Firebase 
// (Tetap kita biarkan jika nanti dibutuhkan untuk fungsi lain, meskipun untuk lampiran Izin kita akan beralih ke Cloudinary)
export const storage = getStorage(app);