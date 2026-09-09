import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getTodayString, calculateWorkHours } from "../utils/timeUtils";
import toast from "react-hot-toast";
import { format } from "date-fns";

// =================================================================
// HAKIM MUTLAK: Mengambil waktu langsung dari satelit sedetik
// sebelum data dimasukkan ke Database (Mengabaikan jam dari HP)
// =================================================================
const getAbsoluteTrueTime = async (fallbackTime) => {
  try {
    const res = await fetch(
      `https://timeapi.io/api/Time/current/zone?timeZone=UTC&nocache=${Date.now()}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const data = await res.json();
      return new Date(data.dateTime + "Z").toISOString();
    }
    throw new Error("S1 Gagal");
  } catch (err) {
    try {
      const res2 = await fetch(
        `https://worldtimeapi.org/api/timezone/Etc/UTC?nocache=${Date.now()}`,
        { cache: "no-store" },
      );
      if (res2.ok) {
        const data2 = await res2.json();
        return new Date(data2.datetime).toISOString();
      }
    } catch (e) {
      return fallbackTime;
    }
  }
  return fallbackTime;
};

export const attendanceService = {
  // 1. Ambil status absen hari ini
  getTodayAttendance: async (userId) => {
    try {
      const docId = `${userId}_${getTodayString()}`;
      const docRef = doc(db, "attendances", docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error("Error fetching attendance:", error);
      return null;
    }
  },

  // 2. Proses Absen Datang
  checkIn: async (
    userId,
    schoolId,
    latitude,
    longitude,
    distance,
    photoUrl, // Dibiarkan sebagai placeholder agar urutan parameter Dashboard tidak rusak
    clientTimestamp = new Date().toISOString(),
    isOfflineSync = false,
  ) => {
    try {
      let finalTimeStr = clientTimestamp;
      if (!isOfflineSync && navigator.onLine) {
        finalTimeStr = await getAbsoluteTrueTime(clientTimestamp);
      }

      const absoluteDateObj = new Date(finalTimeStr);
      const trueDateStr = format(absoluteDateObj, "yyyy-MM-dd");

      const docId = `${userId}_${trueDateStr}`;
      const docRef = doc(db, "attendances", docId);

      const deviceInfo = navigator.userAgent;

      const payload = {
        user_id: userId,
        school_id: schoolId,
        date: trueDateStr,
        check_in: {
          time: new Date(finalTimeStr),
          latitude,
          longitude,
          distance_meters: distance,
          device_info: deviceInfo,
          // photo_url SUDAH DIHAPUS SEPENUHNYA DARI SINI
        },
        check_out: null,
        total_hours: 0,
        status: "Belum Pulang",
        is_offline_sync: isOfflineSync,
        server_created_at: serverTimestamp(),
      };

      await setDoc(docRef, payload, { merge: true });
      if (!isOfflineSync) toast.success("Berhasil Absen Datang!");
      return payload;
    } catch (error) {
      console.error("CheckIn error:", error);
      if (!isOfflineSync) toast.error("Gagal melakukan Absen Datang.");
      return null;
    }
  },

  // 3. Proses Absen Pulang
  checkOut: async (
    userId,
    latitude,
    longitude,
    distance,
    checkInTime,
    photoUrl, // Placeholder
    clientTimestamp = new Date().toISOString(),
    isOfflineSync = false,
  ) => {
    try {
      let finalTimeStr = clientTimestamp;
      if (!isOfflineSync && navigator.onLine) {
        finalTimeStr = await getAbsoluteTrueTime(clientTimestamp);
      }

      const absoluteDateObj = new Date(finalTimeStr);
      const trueDateStr = format(absoluteDateObj, "yyyy-MM-dd");

      const docId = `${userId}_${trueDateStr}`;
      const docRef = doc(db, "attendances", docId);

      const checkInDate = checkInTime?.toDate
        ? checkInTime.toDate()
        : new Date(checkInTime);

      const totalHours = calculateWorkHours(checkInDate, absoluteDateObj);
      const finalStatus = totalHours >= 8 ? "Memenuhi Target" : "Kurang Jam";

      const payloadUpdate = {
        check_out: {
          time: new Date(finalTimeStr),
          latitude,
          longitude,
          distance_meters: distance,
          // photo_url SUDAH DIHAPUS SEPENUHNYA DARI SINI
        },
        total_hours: totalHours,
        status: finalStatus,
        is_offline_sync_out: isOfflineSync,
        server_updated_at: serverTimestamp(),
      };

      await updateDoc(docRef, payloadUpdate);
      if (!isOfflineSync) toast.success("Berhasil Absen Pulang!");
      return payloadUpdate;
    } catch (error) {
      console.error("CheckOut error:", error);
      if (!isOfflineSync) toast.error("Gagal melakukan Absen Pulang.");
      return null;
    }
  },

  // 4. Ambil Riwayat Absen berdasarkan Bulan & Tahun
  getHistory: async (userId, month, year) => {
    try {
      const q = query(
        collection(db, "attendances"),
        where("user_id", "==", userId),
      );

      const querySnapshot = await getDocs(q);
      const history = [];

      const searchPrefix = `${year}-${month}`;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.date && data.date.startsWith(searchPrefix)) {
          history.push({ id: doc.id, ...data });
        }
      });

      return history.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error("Error fetching history:", error);
      return [];
    }
  },
};
