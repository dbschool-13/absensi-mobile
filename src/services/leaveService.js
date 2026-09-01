import { db, storage } from "../config/firebase"; // Sesuaikan dengan path firebase Anda
import { 
  collection, addDoc, getDocs, doc, updateDoc, 
  query, where, orderBy, writeBatch, serverTimestamp 
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { eachDayOfInterval, format, parseISO } from "date-fns";

export const leaveService = {
  // ==========================================
  // 1. FUNGSI UNTUK GURU: Mengirim Permohonan
  // ==========================================
  submitLeaveRequest: async (leaveData) => {
    try {
      let buktiUrl = "";

      // Jika ada file bukti (Base64 dari jepretan kamera atau upload file)
      if (leaveData.bukti_base64) {
        const fileName = `leaves/${leaveData.user_id}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        await uploadString(storageRef, leaveData.bukti_base64, 'data_url');
        buktiUrl = await getDownloadURL(storageRef);
      }

      const requestPayload = {
        user_id: leaveData.user_id,
        school_id: leaveData.school_id,
        nama: leaveData.nama,
        jenis: leaveData.jenis, // "Sakit", "Izin", "Cuti"
        start_date: leaveData.start_date, // Format: "YYYY-MM-DD"
        end_date: leaveData.end_date,     // Format: "YYYY-MM-DD"
        keterangan: leaveData.keterangan,
        bukti_url: buktiUrl,
        status: "Pending", // Status awal selalu Pending
        created_at: serverTimestamp(),
      };

      await addDoc(collection(db, "leave_requests"), requestPayload);
      return true;
    } catch (error) {
      console.error("Gagal mengirim permohonan:", error);
      return false;
    }
  },

  // ==========================================
  // 2. FUNGSI UNTUK GURU: Melihat Riwayat Permohonan Sendiri
  // ==========================================
  getUserLeaveRequests: async (userId) => {
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("user_id", "==", userId),
        orderBy("created_at", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Gagal mengambil data permohonan user:", error);
      return [];
    }
  },

  // ==========================================
  // 3. FUNGSI UNTUK ADMIN: Melihat Semua Permohonan di Sekolah
  // ==========================================
  getSchoolLeaveRequests: async (schoolId) => {
    try {
      const q = query(
        collection(db, "leave_requests"),
        where("school_id", "==", schoolId),
        orderBy("created_at", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Gagal mengambil data permohonan sekolah:", error);
      return [];
    }
  },

  // ==========================================
  // 4. FUNGSI UNTUK ADMIN: Menolak Permohonan
  // ==========================================
  rejectLeaveRequest: async (requestId) => {
    try {
      const docRef = doc(db, "leave_requests", requestId);
      await updateDoc(docRef, { 
        status: "Rejected",
        updated_at: serverTimestamp() 
      });
      return true;
    } catch (error) {
      console.error("Gagal menolak permohonan:", error);
      return false;
    }
  },

  // ==========================================
  // 5. FUNGSI UNTUK ADMIN (KUNCI UTAMA): Menyetujui & AUTO-INJECT ABSEN
  // ==========================================
  approveLeaveRequest: async (requestData, activeWorkingDays = [1,2,3,4,5], holidays = []) => {
    try {
      // Kita gunakan writeBatch agar update status dan suntik absen dieksekusi bersamaan (Atomicity)
      const batch = writeBatch(db);

      // A. Update Status Permohonan menjadi "Approved"
      const requestRef = doc(db, "leave_requests", requestData.id);
      batch.update(requestRef, { 
        status: "Approved",
        updated_at: serverTimestamp()
      });

      // B. Hitung rentang hari dari start_date ke end_date
      const start = parseISO(requestData.start_date);
      const end = parseISO(requestData.end_date);
      const datesToProcess = eachDayOfInterval({ start, end });

      // C. Loop setiap hari dan Suntik ke collection "attendances"
      const attendancesColRef = collection(db, "attendances");

      datesToProcess.forEach((dateObj) => {
        const dayOfWeek = dateObj.getDay();
        const dateStr = format(dateObj, "yyyy-MM-dd");
        const isHoliday = holidays.some((h) => h.date === dateStr);

        // Hanya suntik absen jika hari tersebut adalah HARI KERJA (Bukan Sabtu/Minggu/Libur)
        if (activeWorkingDays.includes(dayOfWeek) && !isHoliday) {
          const newAttRef = doc(attendancesColRef); // Buat ID dokumen baru secara otomatis
          
          batch.set(newAttRef, {
            user_id: requestData.user_id,
            school_id: requestData.school_id,
            date: dateStr,
            check_in: null, // Kosongkan jam fisik
            check_out: null,
            total_hours: 8, // Suntik 8 jam agar persentase kehadiran aman
            status: requestData.jenis, // "Sakit", "Izin", atau "Cuti"
            is_leave: true, // Penanda penting bahwa ini adalah absen non-fisik
            leave_request_id: requestData.id, // Referensi silang
            created_at: serverTimestamp()
          });
        }
      });

      // Eksekusi semua perintah dalam satu waktu (Commit)
      await batch.commit();
      return true;
    } catch (error) {
      console.error("Gagal menyetujui permohonan:", error);
      return false;
    }
  }
};