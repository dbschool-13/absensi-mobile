import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch, // <-- PERBAIKAN: Menggunakan Batch agar pengiriman sekaligus
} from "firebase/firestore";

export const leaveService = {
  submitLeaveRequest: async (
    nip,
    schoolId,
    type,
    startDate,
    endDate,
    reason,
    attachmentUrl,
  ) => {
    try {
      const docId = Date.now().toString();
      const docRef = doc(db, `schools/${schoolId}/leave_requests`, docId);

      const payload = {
        nip,
        school_id: schoolId,
        type,
        start_date: startDate,
        end_date: endDate,
        reason,
        attachment: attachmentUrl,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      await setDoc(docRef, payload);
      return true;
    } catch (error) {
      console.error("Error submit leave:", error);
      return false;
    }
  },

  getUserHistory: async (nip, schoolId) => {
    if (!schoolId) return [];
    try {
      const q = query(
        collection(db, `schools/${schoolId}/leave_requests`),
        where("nip", "==", nip),
      );
      const snap = await getDocs(q);
      const history = [];
      snap.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      return history.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    } catch (error) {
      console.error("Error get leave history:", error);
      return [];
    }
  },

  approveLeaveRequest: async (requestData) => {
    try {
      const { id, school_id, nip, type, start_date } = requestData;

      // Fallback pengaman jika end_date kosong pada data pengajuan lama
      const end_date =
        requestData.end_date || requestData.endDate || start_date;

      // 1. INISIALISASI BATCH (Bungkus semua tugas jadi 1 paket)
      const batch = writeBatch(db);

      // 2. Update status Izin (Masukkan ke dalam Batch)
      const leaveRef = doc(db, `schools/${school_id}/leave_requests`, id);
      batch.update(leaveRef, { status: "approved" });

      // 3. PARSING TANGGAL AMAN & HITUNG SELISIH HARI
      const startObj = new Date(start_date);
      const endObj = new Date(end_date);

      // Normalkan jam menjadi 00:00:00 untuk menghindari bug beda zona waktu
      startObj.setHours(0, 0, 0, 0);
      endObj.setHours(0, 0, 0, 0);

      // Hitung pasti berapa hari yang harus dilooping (Misal: 29 ke 30 = beda 1 hari = butuh 2 loop)
      const diffTime = Math.abs(endObj - startObj);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // 4. LOOPING MATEMATIS & SUNTIK KE BATCH
      for (let i = 0; i <= diffDays; i++) {
        // Buat objek tanggal baru setiap putaran berdasarkan startObj + i
        const loopDate = new Date(startObj);
        loopDate.setDate(startObj.getDate() + i);

        // Format ke YYYY-MM-DD
        const yyyy = loopDate.getFullYear();
        const mm = String(loopDate.getMonth() + 1).padStart(2, "0");
        const dd = String(loopDate.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const attDocId = `${nip}_${dateStr}`;
        const attRef = doc(db, `schools/${school_id}/attendances`, attDocId);

        // Masukkan injeksi absen ke dalam Batch
        batch.set(
          attRef,
          {
            user_id: nip,
            school_id: school_id,
            date: dateStr,
            status: type,
            total_hours: type === "izin_kedinasan" || type === "cuti" ? 8 : 0,
            check_in: { time: "[AUTO-INJECT]", latitude: 0, longitude: 0 },
            check_out: { time: "[AUTO-INJECT]", latitude: 0, longitude: 0 },
            is_auto_injected: true,
            server_created_at: serverTimestamp(),
          },
          { merge: true }, // Merge memastikan jika dokumen sudah ada, tidak menimpa data lain
        );
      }

      // 5. EKSEKUSI SELURUH BATCH SECARA BERSAMAAN (1x Request ke Server)
      await batch.commit();

      return true;
    } catch (error) {
      console.error("Error approve leave:", error);
      return false;
    }
  },

  rejectLeaveRequest: async (requestId, schoolId) => {
    try {
      const leaveRef = doc(db, `schools/${schoolId}/leave_requests`, requestId);
      await updateDoc(leaveRef, { status: "rejected" });
      return true;
    } catch (error) {
      console.error("Error reject leave:", error);
      return false;
    }
  },
};
