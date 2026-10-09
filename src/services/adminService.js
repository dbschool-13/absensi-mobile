import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc, // Tambahan untuk cek dokumen spesifik
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getCountFromServer,
  writeBatch, // Tambahan untuk Import Excel
  serverTimestamp, // Tambahan untuk Timestamp
} from "firebase/firestore";
import { getTodayString } from "../utils/timeUtils";

export const adminService = {
  // 1. Ambil Statistik Hari Ini
  getDashboardStats: async (schoolId) => {
    if (!schoolId)
      return { totalPegawai: 0, hadir: 0, belumHadir: 0, persentase: 0 };

    try {
      // Menghitung jumlah pegawai secara instan di sisi server (Cost: 1 Read)
      const validRoles = ["guru", "tendik", "kepsek"];
      const qUsers = query(
        collection(db, `schools/${schoolId}/users`),
        where("role", "in", validRoles),
      );

      const userSnap = await getCountFromServer(qUsers);
      const totalPegawai = userSnap.data().count;

      // Kueri Tarikan Absen Hari Ini
      const today = getTodayString(); 
      const qAtt = query(
        collection(db, `schools/${schoolId}/attendances`),
        where("date", "==", today),
      );
      const attSnap = await getDocs(qAtt);

      let hadir = 0;

      attSnap.forEach((doc) => {
        const att = doc.data();
        const isInject =
          att.is_auto_injected === true ||
          att.check_in?.time === "[AUTO-INJECT]";
        const statusVal = (att.status || "").toLowerCase();

        // Jangan hitung sebagai hadir jika statusnya Sakit atau Izin Pribadi/Kedinasan
        if (
          isInject &&
          (statusVal === "sakit" ||
            statusVal === "izin_pribadi" ||
            statusVal.includes("izin"))
        ) {
          return; 
        }
        hadir++;
      });

      const belumHadir = Math.max(totalPegawai - hadir, 0);
      const persentase =
        totalPegawai > 0 ? Math.round((hadir / totalPegawai) * 100) : 0;

      return { totalPegawai, hadir, belumHadir, persentase };
    } catch (error) {
      console.error("Gagal mengambil statistik:", error);
      return { totalPegawai: 0, hadir: 0, belumHadir: 0, persentase: 0 };
    }
  },

  // 2. Ambil Daftar Guru & Kepsek di Sekolah ini
  getTeachers: async (schoolId) => {
    if (!schoolId) return [];
    try {
      const q = collection(db, `schools/${schoolId}/users`);
      const snap = await getDocs(q);
      const teachers = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (["guru", "kepsek", "tendik"].includes(data.role)) {
          teachers.push({ id: doc.id, ...data });
        }
      });
      return teachers;
    } catch (error) {
      console.error("Gagal mengambil data guru:", error);
      return [];
    }
  },

  // 3. Ambil Data Rekap Bulanan
  getRekapData: async (schoolId, month, year) => {
    if (!schoolId) return [];
    try {
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`; 

      const q = query(
        collection(db, `schools/${schoolId}/attendances`),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
      );

      const snap = await getDocs(q);
      const attendances = [];

      snap.forEach((doc) => {
        attendances.push({ id: doc.id, ...doc.data() });
      });

      return attendances;
    } catch (error) {
      console.error("Gagal mengambil rekap data:", error);
      return [];
    }
  },

  // 4. Update Setting Sekolah
  updateSchoolSettings: async (schoolId, payload) => {
    if (!schoolId) return false;
    try {
      const schoolRef = doc(db, "schools", schoolId);
      await updateDoc(schoolRef, payload);
      return true;
    } catch (error) {
      console.error("Gagal update setting:", error);
      return false;
    }
  },

  // 5. Tambah Pegawai Baru (HANYA KE SUB-COLLECTION DENGAN ID = NIP)
  addTeacher: async (teacherData) => {
    try {
      const { nip, school_id } = teacherData;
      
      // Gunakan NIP sebagai nama dokumen agar terhindar dari duplikasi otomatis
      const docRef = doc(db, `schools/${school_id}/users`, nip);
      
      // Cek apakah NIP sudah dipakai di sekolah ini (Cost: 1 Read)
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { success: false, message: "NIP tersebut sudah terdaftar di sistem!" };
      }

      const payload = {
        ...teacherData,
        role: teacherData.role || "guru",
        is_active: true,
        created_at: serverTimestamp(),
      };

      await setDoc(docRef, payload);

      return { success: true, message: "Pegawai berhasil ditambahkan!" };
    } catch (error) {
      console.error("Gagal menambah pegawai:", error);
      return { success: false, message: "Terjadi kesalahan pada server." };
    }
  },

  // 5.B (FUNGSI BARU) IMPORT EXCEL MASSAL DENGAN BATCH
  importTeachersBatch: async (teachersArray, schoolId) => {
    if (!teachersArray || teachersArray.length === 0) return { success: false };
    
    try {
      const batch = writeBatch(db);
      
      teachersArray.forEach((teacher) => {
        // NIP dijadikan sebagai Document ID
        const docRef = doc(db, `schools/${schoolId}/users`, teacher.nip);
        batch.set(docRef, {
          ...teacher,
          is_active: true,
          created_at: serverTimestamp()
        });
      });

      // Commit semua data dalam 1 tembakan request (Atomic Batch)
      await batch.commit();
      return { success: true, count: teachersArray.length };
    } catch (error) {
      console.error("Error batch import:", error);
      return { success: false, message: "Gagal melakukan impor massal ke database." };
    }
  },

  // 6. Hapus Data Guru (HAPUS DARI SUB-COLLECTION)
  deleteTeacher: async (docId, schoolId) => {
    if (!docId || !schoolId) return false;
    try {
      // Hapus dari Sub-Collection
      await deleteDoc(doc(db, `schools/${schoolId}/users`, docId));
      
      // Opsional (Fallback): Hapus dari koleksi global JIKA data tersebut masih sisa arsitektur lama
      try { await deleteDoc(doc(db, "users", docId)); } catch (e) {}
      
      return true;
    } catch (error) {
      console.error("Gagal menghapus guru:", error);
      return false;
    }
  },

  // 7. Reset ID Perangkat
  resetDevice: async (docId, schoolId) => {
    if (!docId || !schoolId) return false;
    try {
      // Reset dari Sub-Collection
      await updateDoc(doc(db, `schools/${schoolId}/users`, docId), {
        device_id: null,
      });

      // Opsional (Fallback): Reset dari koleksi global JIKA data tersebut masih sisa arsitektur lama
      try { await updateDoc(doc(db, "users", docId), { device_id: null }); } catch (e) {}
      
      return true;
    } catch (error) {
      console.error("Gagal reset device:", error);
      return false;
    }
  },
};