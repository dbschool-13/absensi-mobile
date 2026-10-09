import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../services/firebase";
import { Device } from "@capacitor/device";
import {
  collectionGroup, // KUNCI UTAMA: Menggantikan collection biasa
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import toast from "react-hot-toast";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGlobalLoading, setGlobalLoading] = useState(false);

  // Fungsi Helper: Ambil ID Unik Hardware
  const getHardwareDeviceId = async () => {
    try {
      const info = await Device.getId();
      return info.identifier; 
    } catch (error) {
      let webId = localStorage.getItem("app_device_id");
      if (!webId) {
        webId =
          "web_" +
          Math.random().toString(36).substr(2, 9) +
          Date.now().toString(36);
        localStorage.setItem("app_device_id", webId);
      }
      return webId;
    }
  };

  const fetchSchoolData = async (schoolId) => {
    try {
      const schoolRef = doc(db, "schools", schoolId);
      const docSnap = await getDoc(schoolRef);
      if (docSnap.exists()) {
        setSchoolData(docSnap.data());
      }
    } catch (error) {
      console.error("Gagal memuat data sekolah:", error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem("guru_user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        await fetchSchoolData(parsedUser.school_id);
      }
      setLoading(false);
    };
    initializeAuth();
  }, []);

  // Fungsi Login Utama
  const login = async (nip, password) => {
    try {
      setGlobalLoading(true);

      // ==========================================
      // PERBAIKAN 1: MENGGUNAKAN COLLECTION GROUP
      // Mencari NIP di semua sub-koleksi "users" di seluruh sekolah
      // ==========================================
      const usersQuery = query(
        collectionGroup(db, "users"),
        where("nip", "==", nip),
        where("password", "==", password)
      );
      const querySnapshot = await getDocs(usersQuery);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        let userData = userDoc.data();

        // ==========================================
        // CEK DEVICE BINDING (BERLAKU UNTUK GURU & TENDIK)
        // ==========================================
        if (userData.role !== "admin") {
          const schoolRef = doc(db, "schools", userData.school_id);
          const schoolSnap = await getDoc(schoolRef);
          const schoolConfig = schoolSnap.data();

          if (schoolConfig?.enable_device_binding) {
            const localDeviceId = await getHardwareDeviceId(); 

            // Aturan 1: Jika AKUN ini sudah terikat dengan HP lain
            if (userData.device_id && userData.device_id !== localDeviceId) {
              setGlobalLoading(false);
              toast.error(
                "Akses Ditolak! Akun Anda telah tertaut di perangkat lain."
              );
              return false;
            }

            // Aturan 2: Jika AKUN ini belum terikat, cek apakah HP ini milik orang lain
            if (!userData.device_id) {
              // Gunakan collectionGroup juga untuk memastikan HP ini tidak dipakai pegawai manapun
              const checkDeviceQuery = query(
                collectionGroup(db, "users"),
                where("device_id", "==", localDeviceId)
              );
              const deviceSnap = await getDocs(checkDeviceQuery);

              if (!deviceSnap.empty) {
                setGlobalLoading(false);
                toast.error(
                  "Akses Ditolak! HP ini sudah terdaftar untuk pegawai lain. 1 HP hanya untuk 1 Akun."
                );
                return false;
              }

              // ==========================================
              // PERBAIKAN 2: SINKRONISASI TUNGGAL (LEBIH AMAN & BERSIH)
              // updateDoc pada userDoc.ref akan otomatis menunjuk ke sub-collection yang benar
              // tanpa perlu membuat path manual `schools/{schoolId}/users/{nip}`
              // ==========================================
              await updateDoc(userDoc.ref, { device_id: localDeviceId });
              
              userData.device_id = localDeviceId;
            }
          }
        }

        const userObj = { id: userDoc.id, ...userData };
        delete userObj.password; // Jangan simpan password ke localStorage

        setUser(userObj);
        localStorage.setItem("guru_user", JSON.stringify(userObj));

        await fetchSchoolData(userObj.school_id);

        setGlobalLoading(false);
        return true;
      } else {
        setGlobalLoading(false);
        toast.error("NIP atau Password salah!");
        return false;
      }
    } catch (error) {
      setGlobalLoading(false);
      console.error("Login error:", error);
      toast.error("Gagal terhubung ke server.");
      return false;
    }
  };

  const logout = () => {
    setGlobalLoading(true);
    setTimeout(() => {
      setUser(null);
      setSchoolData(null);
      localStorage.removeItem("guru_user");
      setGlobalLoading(false);
    }, 800);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        schoolData,
        login,
        logout,
        loading,
        isGlobalLoading,
        setGlobalLoading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};