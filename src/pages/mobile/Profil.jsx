import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  User,
  CreditCard,
  Building2,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Info,
} from "lucide-react";
import { db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Profil() {
  const { user, logout } = useAuth();
  const [schoolName, setSchoolName] = useState("Memuat data...");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    const fetchSchool = async () => {
      if (user?.school_id) {
        try {
          const schoolRef = doc(db, "schools", user.school_id);
          const docSnap = await getDoc(schoolRef);
          if (docSnap.exists()) setSchoolName(docSnap.data().name);
          else setSchoolName("Sekolah tidak ditemukan");
        } catch (error) {
          setSchoolName("Gagal memuat data");
        }
      }
    };
    fetchSchool();
  }, [user]);

  const handleLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
  };

  // Fungsi untuk menampilkan nama Role dengan rapi
  const getRoleName = (roleCode) => {
    switch (roleCode) {
      case "admin":
        return "Administrator";
      case "kepsek":
        return "Kepala Sekolah";
      case "tendik":
        return "Tenaga Kependidikan";
      default:
        return "Guru / Pendidik";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* 1. HEADER SECTION */}
      <div className="bg-gradient-to-b from-primary to-primary_dark text-white pt-12 pb-24 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden flex flex-col items-center">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-10 left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>

        <div className="relative z-10 mb-4">
          <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/40 shadow-xl">
            <User size={40} className="text-white drop-shadow-md" />
          </div>
          <div className="absolute bottom-0 right-0 bg-emerald-500 w-6 h-6 rounded-full border-2 border-primary_dark flex items-center justify-center shadow-lg">
            <ShieldCheck size={12} className="text-white" />
          </div>
        </div>

        <div className="text-center relative z-10">
          <h1 className="text-xl font-bold tracking-wide">
            {user?.name || "Nama Pegawai"}
          </h1>
          <p className="text-[11px] text-indigo-200 mt-1 uppercase tracking-widest font-bold">
            {getRoleName(user?.role)}
          </p>
        </div>
      </div>

      {/* 2. OVERLAPPING INFO CARD */}
      <div className="-mt-12 mx-5 relative z-20 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-2 border border-gray-100">
          <div className="p-4 flex items-center gap-4 border-b border-gray-50">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <CreditCard size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                NIP / NIK
              </p>
              <p className="text-sm font-bold text-gray-800">
                {user?.nip || "-"}
              </p>
            </div>
          </div>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Building2 size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Instansi / Sekolah
              </p>
              <p className="text-sm font-bold text-gray-800 line-clamp-1">
                {schoolName}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-2 border border-gray-100">
          <button className="w-full p-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50 transition-colors rounded-t-2xl">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500">
                <Info size={18} />
              </div>
              <span className="text-sm font-bold text-gray-700">
                Tentang Aplikasi
              </span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <div className="w-full p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500">
                <ShieldCheck size={18} />
              </div>
              <span className="text-sm font-bold text-gray-700">
                Versi Aplikasi
              </span>
            </div>
            <span className="text-xs font-bold text-gray-400">v1.0.0</span>
          </div>
        </div>
      </div>

      {/* 3. LOGOUT BUTTON */}
      <div className="px-5 mt-8">
        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className="w-full bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 transition-all py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border border-red-100 shadow-sm"
        >
          <LogOut size={18} />
          <span>Keluar Akun</span>
        </button>
      </div>

      {/* 4. MODAL KONFIRMASI LOGOUT */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-gray-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xs overflow-hidden animate-[flyIn_0.3s_ease-out]">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                <LogOut size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Keluar Aplikasi?
                </h3>
                <p className="text-xs text-gray-500 mt-2 line-height-relaxed">
                  Anda harus login kembali menggunakan NIP dan Password untuk
                  melakukan absensi.
                </p>
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 text-sm transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg text-sm transition-colors flex justify-center items-center bg-red-500 hover:bg-red-600 shadow-red-500/30"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
