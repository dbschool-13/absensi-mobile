import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { getTodayString } from "../utils/timeUtils";

export const adminService = {
  // 1. Ambil Statistik Hari Ini
  getDashboardStats: async (schoolId) => {
    if (!schoolId)
      return { totalPegawai: 0, hadir: 0, belumHadir: 0, persentase: 0 };

    try {
      // BACA DARI SUB-KOLEKSI
      const qUsers = collection(db, `schools/${schoolId}/users`);
      const userSnap = await getDocs(qUsers);

      let totalPegawai = 0;
      const validRoles = ["guru", "tendik", "kepsek"];

      userSnap.forEach((doc) => {
        const data = doc.data();
        const role = (data.role || "").toLowerCase();
        if (validRoles.includes(role)) {
          totalPegawai++;
        }
      });

      // Hitung Absen Hari Ini di sub-koleksi
      const today = getTodayString();
      const qAtt = query(
        collection(db, `schools/${schoolId}/attendances`),
        where("date", "==", today),
      );
      const attSnap = await getDocs(qAtt);

      let hadir = 0;

      // ==========================================
      // PERBAIKAN LOGIKA HITUNG HADIR (AUTO-INJECT)
      // ==========================================
      attSnap.forEach((doc) => {
        const att = doc.data();
        const isInject =
          att.is_auto_injected === true ||
          att.check_in?.time === "[AUTO-INJECT]";
        const statusVal = (att.status || "").toLowerCase();

        // Jangan hitung sebagai hadir jika statusnya Sakit atau Izin Pribadi
        if (
          isInject &&
          (statusVal === "sakit" ||
            statusVal === "izin_pribadi" ||
            statusVal.includes("izin"))
        ) {
          return; // Skip (tidak dihitung hadir)
        }
        hadir++; // Dihitung hadir (Hadir fisik ATAU Cuti/Kedinasan jika aturan sekolah menganggapnya hadir)
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
      const q = collection(db, `schools/${schoolId}/attendances`);
      const snap = await getDocs(q);
      const attendances = [];
      const searchPrefix = `${year}-${month}`;

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.date && data.date.startsWith(searchPrefix)) {
          attendances.push({ id: doc.id, ...data });
        }
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

  // 5. Tambah Pegawai Baru (Guru/Kepsek/Tendik)
  addTeacher: async (teacherData) => {
    try {
      const q = query(
        collection(db, "users"),
        where("nip", "==", teacherData.nip),
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        return { success: false, message: "NIP sudah terdaftar!" };
      }

      const newDocRef = doc(collection(db, "users"));
      const payload = {
        ...teacherData,
        role: teacherData.role || "guru",
        is_active: true,
      };

      await setDoc(newDocRef, payload);

      if (teacherData.school_id) {
        const subCollectionRef = doc(
          db,
          `schools/${teacherData.school_id}/users`,
          newDocRef.id,
        );
        await setDoc(subCollectionRef, payload);
      }

      return { success: true, message: "Pegawai berhasil ditambahkan!" };
    } catch (error) {
      console.error("Gagal menambah pegawai:", error);
      return { success: false, message: "Terjadi kesalahan pada server." };
    }
  },

  // 6. Hapus Data Guru
  deleteTeacher: async (docId, schoolId) => {
    if (!docId || !schoolId) return false;
    try {
      await deleteDoc(doc(db, "users", docId));
      await deleteDoc(doc(db, `schools/${schoolId}/users`, docId));
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
      await updateDoc(doc(db, "users", docId), { device_id: null });
      await updateDoc(doc(db, `schools/${schoolId}/users`, docId), {
        device_id: null,
      });
      return true;
    } catch (error) {
      console.error("Gagal reset device:", error);
      return false;
    }
  },
};
