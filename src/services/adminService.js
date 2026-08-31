import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getTodayString } from "../utils/timeUtils";

export const adminService = {
  // Ambil Statistik Hari Ini
  getDashboardStats: async (schoolId) => {
    try {
      // 1. Ambil SEMUA user berdasarkan school_id saja (Aman dari error Index Firebase)
      const qUsers = query(
        collection(db, "users"),
        where("school_id", "==", schoolId),
      );
      const userSnap = await getDocs(qUsers);

      // 2. Filter secara manual (Kebal terhadap huruf besar/kecil)
      let totalPegawai = 0;
      const validRoles = ["guru", "tendik", "kepsek"];

      userSnap.forEach((doc) => {
        const data = doc.data();
        // Ubah role menjadi huruf kecil semua agar "Guru", "GURU", "guru" dianggap sama
        const role = (data.role || "").toLowerCase();

        if (validRoles.includes(role)) {
          totalPegawai++;
        }
      });

      // 3. Hitung Absen Hari Ini di sekolah ini
      const today = getTodayString();
      const qAtt = query(
        collection(db, "attendances"),
        where("school_id", "==", schoolId),
        where("date", "==", today),
      );
      const attSnap = await getDocs(qAtt);
      const hadir = attSnap.size;

      // 4. Kalkulasi (Gunakan Math.max agar tidak minus)
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
    try {
      const { collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );
      // Ambil semua user di sekolah ini
      const q = query(
        collection(db, "users"),
        where("school_id", "==", schoolId),
      );
      const snap = await getDocs(q);
      const teachers = [];
      snap.forEach((doc) => {
        const data = doc.data();
        // Filter hanya guru dan kepsek (kecualikan admin web)
        if (
          data.role === "guru" ||
          data.role === "kepsek" ||
          data.role === "tendik"
        ) {
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
    try {
      const { collection, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      // Ambil semua absensi sekolah ini
      const q = query(
        collection(db, "attendances"),
        where("school_id", "==", schoolId),
      );

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
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
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
      const { collection, addDoc, query, where, getDocs } = await import(
        "firebase/firestore"
      );

      // Cek apakah NIP sudah terdaftar
      const q = query(
        collection(db, "users"),
        where("nip", "==", teacherData.nip),
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        return { success: false, message: "NIP sudah terdaftar!" };
      }

      // PERBAIKAN DI SINI: Gunakan role dari teacherData, jika tidak ada baru gunakan 'guru'
      await addDoc(collection(db, "users"), {
        ...teacherData,
        role: teacherData.role || "guru", // <--- Baris ini yang sebelumnya hardcode 'guru'
        is_active: true,
      });

      return { success: true, message: "Pegawai berhasil ditambahkan!" };
    } catch (error) {
      console.error("Gagal menambah pegawai:", error);
      return { success: false, message: "Terjadi kesalahan pada server." };
    }
  },

  // 6. Hapus Data Guru
  deleteTeacher: async (docId) => {
    try {
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "users", docId));
      return true;
    } catch (error) {
      console.error("Gagal menghapus guru:", error);
      return false;
    }
  },

  // 7. Reset ID Perangkat (Device Binding)
  resetDevice: async (docId) => {
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "users", docId), { device_id: null });
      return true;
    } catch (error) {
      console.error("Gagal reset device:", error);
      return false;
    }
  },
};
