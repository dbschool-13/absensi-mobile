import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc, // Tambahan untuk membaca data Sekolah
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { eachDayOfInterval, format } from "date-fns";

export const leaveService = {
  // 1. Submit Pengajuan
  submitLeaveRequest: async (
    nip,
    school_id,
    type,
    startDate,
    endDate,
    reason,
    imageBase64,
  ) => {
    try {
      await addDoc(collection(db, "leave_requests"), {
        nip,
        school_id,
        type,
        start_date: startDate,
        end_date: endDate,
        reason,
        attachment: imageBase64,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error("Error submit leave:", error);
      return false;
    }
  },

  // 2. Tarik Riwayat (User)
  getUserHistory: async (nip) => {
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("nip", "==", nip),
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      return [];
    }
  },

  // 3. Tarik Antrean Pending (Admin)
  getPendingRequests: async (school_id) => {
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("school_id", "==", school_id),
        where("status", "==", "pending"),
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } catch (error) {
      return [];
    }
  },

  // 6. Tarik Riwayat yang sudah diproses (Approved/Rejected)
  getResolvedRequests: async (school_id) => {
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("school_id", "==", school_id),
        where("status", "in", ["approved", "rejected"]) // Tarik yang bukan pending
      );
      const snap = await getDocs(q);
      // Urutkan dari yang terbaru diproses
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); 
    } catch (error) {
      return [];
    }
  },

  // ==========================================
  // PERBAIKAN 1: Setujui & Suntik Absen Otomatis (Skip Libur)
  // ==========================================
  approveLeaveRequest: async (requestData) => {
    try {
      // A. Ubah Status Pengajuan
      const reqRef = doc(db, "leave_requests", requestData.id);
      await updateDoc(reqRef, { status: "approved" });

      // B. Ambil Jadwal Libur dari Profil Sekolah di Database
      const schoolRef = doc(db, "schools", requestData.school_id);
      const schoolSnap = await getDoc(schoolRef);
      let holidays = [];
      let workingDays = [1, 2, 3, 4, 5]; // Default Senin-Jumat

      if (schoolSnap.exists()) {
        const sData = schoolSnap.data();
        if (sData.holidays) holidays = sData.holidays;
        if (sData.working_days) workingDays = sData.working_days;
      }

      // C. Generate rentang tanggal
      const start = new Date(requestData.start_date);
      const end = new Date(requestData.end_date);
      const days = eachDayOfInterval({ start, end });

      // D. Lakukan perulangan untuk setiap hari
      for (const day of days) {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayOfWeek = day.getDay();

        // CEK HARI LIBUR: Jika hari ini bukan hari kerja atau masuk dalam daftar libur nasional -> SKIP!
        const isHoliday = holidays.some((h) => h.date === dateStr);
        if (!workingDays.includes(dayOfWeek) || isHoliday) {
          continue;
        }

        const attId = `${requestData.nip}_${dateStr}`;
        const attRef = doc(db, "attendances", attId);

        let totalHoursInjected = 0;
        let noteLabel = requestData.type.toUpperCase();
        let finalStatus = "completed";

        if (
          requestData.type === "izin_kedinasan" ||
          requestData.type === "cuti"
        ) {
          totalHoursInjected = 8;
          if (requestData.type === "izin_kedinasan")
            noteLabel = "IZIN KEDINASAN";
        } else if (
          requestData.type === "izin_pribadi" ||
          requestData.type === "sakit"
        ) {
          totalHoursInjected = 0;
          if (requestData.type === "izin_pribadi") noteLabel = "IZIN PRIBADI";
          finalStatus = noteLabel;
        }

        const attData = {
          user_id: requestData.nip,
          school_id: requestData.school_id,
          date: dateStr,
          total_hours: totalHoursInjected,
          status: finalStatus,
          notes: `[AUTO-INJECT: ${noteLabel}] - ${requestData.reason}`,
        };

        // Jika 8 Jam, berikan jam masuk & pulang. Jika 0 Jam, kosongkan.
        if (totalHoursInjected === 8) {
          attData.check_in = {
            time: `${dateStr}T07:00:00`,
            status: "on_time",
            lat: 0,
            lng: 0,
            distance: 0,
          };
          attData.check_out = {
            time: `${dateStr}T15:00:00`,
            status: "on_time",
            lat: 0,
            lng: 0,
            distance: 0,
          };
        } else {
          attData.check_in = null;
          attData.check_out = null;
        }

        await setDoc(attRef, attData, { merge: true });
      }

      return true;
    } catch (error) {
      console.error("Error approve leave:", error);
      return false;
    }
  },

  // 5. Tolak Pengajuan
  rejectLeaveRequest: async (requestId) => {
    try {
      const reqRef = doc(db, "leave_requests", requestId);
      await updateDoc(reqRef, { status: "rejected" });
      return true;
    } catch (error) {
      return false;
    }
  },
};
