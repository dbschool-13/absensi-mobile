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
  writeBatch,
} from "firebase/firestore";
import { getTodayString, calculateWorkHours } from "../utils/timeUtils";
import toast from "react-hot-toast";
import { format } from "date-fns";

// =================================================================
// PENCARI WAKTU DUAL-SERVER
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
  getTodayAttendance: async (userId, schoolId) => {
    if (!schoolId) return null;
    try {
      const docId = `${userId}_${getTodayString()}`;
      const docRef = doc(db, `schools/${schoolId}/attendances`, docId);
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

  // 2. Proses Absen Datang (DIPERBARUI: DETEKSI TERLAMBAT)
  checkIn: async (
    userId,
    schoolId,
    latitude,
    longitude,
    distance,
    photoUrl,
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
      const currentTimeStr = format(absoluteDateObj, "HH:mm"); // Format HH:mm (cth: 07:16)

      // ==========================================
      // LOGIKA PENGECEKAN BATAS TERLAMBAT
      // ==========================================
      let isLate = false;
      try {
        const schoolSnap = await getDoc(doc(db, "schools", schoolId));
        if (schoolSnap.exists()) {
          const sData = schoolSnap.data();
          if (sData.enable_late_status && sData.time_rules?.late_threshold) {
            // Bandingkan string waktu (cth: "07:16" > "07:15" -> true)
            if (currentTimeStr > sData.time_rules.late_threshold) {
              isLate = true;
            }
          }
        }
      } catch (err) {
        console.warn("Gagal mengecek aturan terlambat", err);
      }

      const docId = `${userId}_${trueDateStr}`;
      const docRef = doc(db, `schools/${schoolId}/attendances`, docId);

      const payload = {
        user_id: userId,
        school_id: schoolId,
        date: trueDateStr,
        check_in: {
          time: new Date(finalTimeStr),
          latitude,
          longitude,
          distance_meters: distance,
          device_info: navigator.userAgent,
          is_late: isLate, // Penanda terlambat di objek check_in
        },
        is_late: isLate, // Penanda terlambat di root dokumen (untuk mempermudah filter rekap)
        check_out: null,
        total_hours: 0,
        status: "Belum Pulang",
        is_offline_sync: isOfflineSync,
        server_created_at: serverTimestamp(),
      };

      await setDoc(docRef, payload, { merge: true });
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
    schoolId,
    latitude,
    longitude,
    distance,
    checkInTime,
    photoUrl,
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
      const docRef = doc(db, `schools/${schoolId}/attendances`, docId);

      let checkInDate;
      if (checkInTime === "[AUTO-INJECT]") {
        checkInDate = absoluteDateObj;
      } else {
        checkInDate = checkInTime?.toDate
          ? checkInTime.toDate()
          : new Date(checkInTime);
      }

      const totalHours = calculateWorkHours(checkInDate, absoluteDateObj);
      const finalStatus = totalHours >= 8 ? "Memenuhi Target" : "Kurang Jam";

      const payloadUpdate = {
        check_out: {
          time: new Date(finalTimeStr),
          latitude,
          longitude,
          distance_meters: distance,
        },
        total_hours: totalHours,
        status: finalStatus,
        is_offline_sync_out: isOfflineSync,
        server_updated_at: serverTimestamp(),
      };

      await updateDoc(docRef, payloadUpdate);
      return payloadUpdate;
    } catch (error) {
      console.error("CheckOut error:", error);
      if (!isOfflineSync) toast.error("Gagal melakukan Absen Pulang.");
      return null;
    }
  },

  // 4. Ambil Riwayat Absen
  getHistory: async (userId, schoolId, month, year) => {
    if (!schoolId) return [];
    try {
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      const q = query(
        collection(db, `schools/${schoolId}/attendances`),
        where("user_id", "==", userId),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
      );

      const querySnapshot = await getDocs(q);
      const history = [];

      querySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });

      return history.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      console.error("Error fetching history:", error);
      return [];
    }
  },

  // ==========================================
  // 5. SINKRONISASI OFFLINE BATCH (DIPERBARUI)
  // ==========================================
  syncOfflineBatch: async (queueData) => {
    if (!queueData || queueData.length === 0) return true;

    try {
      const batch = writeBatch(db);
      const schoolCache = {}; // Cache agar tidak menarik data sekolah yang sama berulang kali

      // Gunakan for...of karena ada proses await di dalamnya
      for (const data of queueData) {
        const absoluteDateObj = new Date(data.timestamp);
        const trueDateStr = format(absoluteDateObj, "yyyy-MM-dd");
        const currentTimeStr = format(absoluteDateObj, "HH:mm");
        const docId = `${data.nip}_${trueDateStr}`;
        const docRef = doc(db, `schools/${data.school_id}/attendances`, docId);

        if (data.type === "datang") {
          
          // Ambil aturan sekolah dan simpan ke Cache
          if (!schoolCache[data.school_id]) {
            const sSnap = await getDoc(doc(db, "schools", data.school_id));
            schoolCache[data.school_id] = sSnap.exists() ? sSnap.data() : null;
          }
          const sData = schoolCache[data.school_id];
          let isLate = false;

          if (sData?.enable_late_status && sData?.time_rules?.late_threshold) {
            if (currentTimeStr > sData.time_rules.late_threshold) {
              isLate = true;
            }
          }

          batch.set(
            docRef,
            {
              user_id: data.nip,
              school_id: data.school_id,
              date: trueDateStr,
              check_in: {
                time: new Date(data.timestamp),
                latitude: data.lat,
                longitude: data.lng,
                distance_meters: data.distance,
                device_info: "Offline-Sync",
                is_late: isLate,
              },
              is_late: isLate,
              check_out: null,
              total_hours: 0,
              status: "Belum Pulang",
              is_offline_sync: true,
              server_created_at: serverTimestamp(),
            },
            { merge: true },
          );
        } else if (data.type === "pulang") {
          let checkInDate;
          if (data.checkInTime === "[AUTO-INJECT]") {
            checkInDate = absoluteDateObj;
          } else {
            checkInDate = data.checkInTime?.toDate
              ? data.checkInTime.toDate()
              : new Date(data.checkInTime || absoluteDateObj);
          }

          const totalHours = calculateWorkHours(checkInDate, absoluteDateObj);
          const finalStatus = totalHours >= 8 ? "Memenuhi Target" : "Kurang Jam";

          batch.update(docRef, {
            check_out: {
              time: new Date(data.timestamp),
              latitude: data.lat,
              longitude: data.lng,
              distance_meters: data.distance,
            },
            total_hours: totalHours,
            status: finalStatus,
            is_offline_sync_out: true,
            server_updated_at: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      return true;
    } catch (error) {
      console.error("Gagal melakukan Sinkronisasi Batch Offline:", error);
      return false;
    }
  },
};