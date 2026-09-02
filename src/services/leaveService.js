import { db } from "./firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { getSecureTime } from "../utils/secureTime";
import { eachDayOfInterval, format, parseISO } from "date-fns";

export const leaveService = {
  /**
   * 1. Fungsi untuk Pegawai: Mengirim Pengajuan Baru
   */
  submitLeaveRequest: async (
    nip,
    schoolId,
    type,
    startDate,
    endDate,
    reason,
    attachmentBase64,
  ) => {
    try {
      const timestamp = getSecureTime().toISOString();

      const payload = {
        nip: nip,
        school_id: schoolId,
        type: type, // "sakit", "izin", atau "cuti"
        start_date: startDate, // Format: YYYY-MM-DD
        end_date: endDate,
        reason: reason,
        attachment: attachmentBase64 || null, // Base64 foto surat (jika ada)
        status: "pending", // Default saat pertama diajukan
        created_at: timestamp,
      };

      const docRef = await addDoc(collection(db, "leave_requests"), payload);
      return { id: docRef.id, ...payload };
    } catch (error) {
      console.error("Gagal mengirim pengajuan:", error);
      throw error;
    }
  },

  /**
   * 2. Fungsi untuk Pegawai: Melihat Riwayat Pengajuan Sendiri
   */
  getUserLeaveHistory: async (nip) => {
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("nip", "==", nip),
        orderBy("created_at", "desc"), // Urutkan dari yang paling baru
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Gagal mengambil riwayat pengajuan:", error);
      return [];
    }
  },

  /**
   * 3. Fungsi untuk Admin: Mengambil Semua Data yang Masih 'Pending'
   */
  getPendingRequests: async (schoolId) => {
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("school_id", "==", schoolId),
        where("status", "==", "pending"),
        orderBy("created_at", "asc"), // Urutkan dari yang paling lama mengantre
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Gagal mengambil data antrean izin:", error);
      return [];
    }
  },

  /**
   * 4A. Fungsi Admin: TOLAK Pengajuan
   */
  rejectLeaveRequest: async (requestId) => {
    try {
      const requestRef = doc(db, "leave_requests", requestId);
      await updateDoc(requestRef, {
        status: "rejected",
        updated_at: getSecureTime().toISOString(),
      });
      return true;
    } catch (error) {
      console.error("Gagal menolak izin:", error);
      return false;
    }
  },

  /**
   * 4B. Fungsi Admin: SETUJUI & SUNTIK ABSEN OTOMATIS
   */
  approveLeaveRequest: async (requestData) => {
    try {
      const { id, nip, school_id, start_date, end_date, type } = requestData;
      const timestamp = getSecureTime().toISOString();

      // 1. Ubah status pengajuan menjadi "approved"
      const requestRef = doc(db, "leave_requests", id);
      await updateDoc(requestRef, {
        status: "approved",
        updated_at: timestamp,
      });

      // 2. INJEKSI ABSEN VIRTUAL OTOMATIS
      const start = parseISO(start_date);
      const end = parseISO(end_date);
      const dateRange = eachDayOfInterval({ start, end });

      // Lakukan perulangan untuk menyuntikkan absen
      for (const date of dateRange) {
        const dateStr = format(date, "yyyy-MM-dd");

        // ==========================================
        // PERBAIKAN: BUAT JAM VIRTUAL (07:00 s/d 15:00)
        // ==========================================
        // Kita paksa jam check-in menjadi jam 7 pagi dan check-out jam 3 sore
        // agar selisihnya terhitung genap 8 jam (100%) di Dashboard
        const virtualCheckIn = new Date(`${dateStr}T07:00:00`).toISOString();
        const virtualCheckOut = new Date(`${dateStr}T15:00:00`).toISOString();

        const attendanceId = `${nip}_${dateStr}`;
        const attRef = doc(db, "attendances", attendanceId);

        await setDoc(
          attRef,
          {
            user_id: nip,
            school_id: school_id,
            date: dateStr,
            status: type,
            is_leave: true,
            total_hours: 8,
            check_in: {
              time: virtualCheckIn, // Menggunakan Jam 07:00
              location: "Sistem",
              status: "Sistem (Izin/Sakit)",
            },
            check_out: {
              time: virtualCheckOut, // Menggunakan Jam 15:00
              location: "Sistem",
              status: "Sistem (Izin/Sakit)",
            },
          },
          { merge: true },
        );
      }
      return true;
    } catch (error) {
      console.error("Gagal menyetujui izin:", error);
      return false;
    }
  },
};
