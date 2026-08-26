import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getTodayString, calculateWorkHours } from "../utils/timeUtils";
import toast from "react-hot-toast";

export const attendanceService = {
  // 1. Ambil status absen hari ini
  getTodayAttendance: async (userId) => {
    try {
      const docId = `${userId}_${getTodayString()}`;
      const docRef = doc(db, "attendances", docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (error) {
      console.error("Error fetching attendance:", error);
      return null;
    }
  },

  // 2. Proses Absen Datang
  checkIn: async (userId, schoolId, latitude, longitude, distance) => {
    try {
      const dateStr = getTodayString();
      const docId = `${userId}_${dateStr}`;
      const docRef = doc(db, "attendances", docId);

      // Deteksi device sederhana
      const deviceInfo = navigator.userAgent;

      const payload = {
        user_id: userId,
        school_id: schoolId,
        date: dateStr,
        check_in: {
          time: new Date(), // Simpan Waktu JS, diubah oleh Firestore
          latitude,
          longitude,
          distance_meters: distance,
          device_info: deviceInfo,
        },
        check_out: null,
        total_hours: 0,
        status: "Belum Pulang",
      };

      await setDoc(docRef, payload);
      toast.success("Berhasil Absen Datang!");
      return payload;
    } catch (error) {
      console.error("CheckIn error:", error);
      toast.error("Gagal melakukan Absen Datang.");
      return null;
    }
  },

  // 3. Proses Absen Pulang
  checkOut: async (userId, latitude, longitude, distance, checkInTime) => {
    try {
      const docId = `${userId}_${getTodayString()}`;
      const docRef = doc(db, "attendances", docId);

      const checkOutDate = new Date();
      // Konversi checkInTime dari Firestore Timestamp ke JS Date (jika diperlukan)
      const checkInDate = checkInTime?.toDate
        ? checkInTime.toDate()
        : new Date(checkInTime);

      // Hitung total jam
      const totalHours = calculateWorkHours(checkInDate, checkOutDate);
      const finalStatus =
        totalHours >= 8 ? "Memenuhi Target" : "Belum Memenuhi Target";

      const payloadUpdate = {
        check_out: {
          time: checkOutDate,
          latitude,
          longitude,
          distance_meters: distance,
        },
        total_hours: totalHours,
        status: finalStatus,
      };

      await updateDoc(docRef, payloadUpdate);
      toast.success("Berhasil Absen Pulang!");
      return payloadUpdate;
    } catch (error) {
      console.error("CheckOut error:", error);
      toast.error("Gagal melakukan Absen Pulang.");
      return null;
    }
  },

  // 4. Ambil Riwayat Absen berdasarkan Bulan & Tahun
  getHistory: async (userId, month, year) => {
    try {
      const { collection, query, where, getDocs } =
        await import("firebase/firestore");

      // Ambil semua absen milik user ini (Menghindari error Composite Index Firebase)
      const q = query(
        collection(db, "attendances"),
        where("user_id", "==", userId),
      );

      const querySnapshot = await getDocs(q);
      const history = [];

      // Format awalan tanggal pencarian. Contoh: "2023-10"
      const searchPrefix = `${year}-${month}`;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter manual: Masukkan hanya data yang tanggalnya berawalan "YYYY-MM"
        if (data.date && data.date.startsWith(searchPrefix)) {
          history.push({ id: doc.id, ...data });
        }
      });

      // Urutkan dari tanggal terbaru (descending)
      return history.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error("Error fetching history:", error);
      return [];
    }
  },
};
