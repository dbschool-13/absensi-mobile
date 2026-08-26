import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import { db } from "../../services/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Users,
  CheckCircle2,
  XCircle,
  Search,
  User as UserIcon,
} from "lucide-react";

export default function KepsekMonitoring() {
  const { user } = useAuth();

  const [teachers, setTeachers] = useState([]);
  const [realtimeAtt, setRealtimeAtt] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchMasterData = async () => {
      if (user?.school_id) {
        const data = await adminService.getTeachers(user.school_id);
        setTeachers(data);
        setLoading(false);
      }
    };
    fetchMasterData();
  }, [user]);

  useEffect(() => {
    if (user?.school_id) {
      const today = format(new Date(), "yyyy-MM-dd");
      const q = query(
        collection(db, "attendances"),
        where("school_id", "==", user.school_id),
        where("date", "==", today),
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const todayData = [];
        snapshot.forEach((doc) =>
          todayData.push({ id: doc.id, ...doc.data() }),
        );
        setRealtimeAtt(todayData);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const monitoringData = teachers
    .map((guru) => {
      const absenHariIni = realtimeAtt.find((att) => att.user_id === guru.nip);
      return { ...guru, absen: absenHariIni || null };
    })
    .sort((a, b) => {
      const aHadir = !!a.absen?.check_in;
      const bHadir = !!b.absen?.check_in;

      if (aHadir && !bHadir) return -1;
      if (!aHadir && bHadir) return 1;

      if (aHadir && bHadir) {
        return b.absen.check_in.time.toDate() - a.absen.check_in.time.toDate();
      }
      return a.name.localeCompare(b.name);
    });

  const filteredData = monitoringData.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPegawai = teachers.length;
  const totalHadir = realtimeAtt.length;
  const totalBelum = totalPegawai - totalHadir;

  return (
    <div className="min-h-screen bg-[#F4F6F9] font-sans pb-8">
      {/* HEADER */}
      <div className="bg-gradient-to-br from-indigo-500 to-primary text-white pt-12 pb-8 px-6 rounded-b-[2rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-300 font-bold text-[10px] uppercase tracking-widest">
              Live Monitoring
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            Status Kehadiran
          </h1>
          <p className="text-xs text-indigo-100 mt-1 font-medium">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
          </p>
        </div>
      </div>

      {/* STATISTIK HORIZONTAL SCROLL */}
      <div className="-mt-5 pl-5 pr-5 flex gap-3 overflow-x-auto pb-4 hide-scrollbar relative z-20">
        <div className="bg-white min-w-[120px] rounded-2xl p-4 shadow-lg shadow-indigo-900/5 border border-gray-100 flex flex-col justify-between">
          <div className="text-blue-500 mb-2">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-800">
              {totalPegawai}
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Pegawai
            </p>
          </div>
        </div>
        <div className="bg-white min-w-[120px] rounded-2xl p-4 shadow-lg shadow-emerald-900/5 border border-gray-100 flex flex-col justify-between relative overflow-hidden">
          <div className="text-emerald-500 mb-2">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-800">{totalHadir}</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Hadir
            </p>
          </div>
        </div>
        <div className="bg-white min-w-[120px] rounded-2xl p-4 shadow-lg shadow-red-900/5 border border-gray-100 flex flex-col justify-between">
          <div className="text-red-500 mb-2">
            <XCircle size={20} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-800">{totalBelum}</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Belum
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-2 space-y-4">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Cari nama pegawai..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-100 shadow-sm rounded-xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm"
          />
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-400 font-medium text-sm animate-pulse">
              Memuat live data...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-400 font-medium text-sm">
              Pegawai tidak ditemukan.
            </div>
          ) : (
            filteredData.map((data) => {
              const isHadir = !!data.absen?.check_in;
              const isPulang = !!data.absen?.check_out;
              const isTargetMet =
                data.absen?.status === "Memenuhi Target" ||
                data.absen?.total_hours >= 8;

              return (
                <div
                  key={data.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                        <UserIcon size={18} className="text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1">
                          {data.name}
                        </h4>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">
                          {data.role}
                        </p>
                      </div>
                    </div>
                    {isPulang ? (
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-[10px] font-bold">
                        Selesai
                      </span>
                    ) : isHadir ? (
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                        Bekerja{" "}
                        <span className="flex h-1.5 w-1.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                      </span>
                    ) : (
                      <span className="bg-red-50 text-red-500 px-2 py-1 rounded-md text-[10px] font-bold">
                        Belum
                      </span>
                    )}
                  </div>

                  <div className="flex gap-4 pt-3 border-t border-gray-50">
                    <div className="flex-1">
                      <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                        Masuk
                      </p>
                      <p className="font-black text-sm text-gray-800">
                        {isHadir
                          ? format(data.absen.check_in.time.toDate(), "HH:mm")
                          : "--:--"}
                      </p>
                    </div>
                    <div className="w-[1px] bg-gray-100"></div>
                    <div className="flex-1">
                      <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                        Pulang
                      </p>
                      {isPulang ? (
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm text-gray-800">
                            {format(
                              data.absen.check_out.time.toDate(),
                              "HH:mm",
                            )}
                          </p>
                          {/* BADGE TARGET DI TAMPILAN MOBILE KEPSEK */}
                          <span
                            className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border ${
                              isTargetMet
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                : "bg-red-50 text-red-500 border-red-100"
                            }`}
                          >
                            {isTargetMet ? "Memenuhi" : "Kurang"}
                          </span>
                        </div>
                      ) : (
                        <p className="font-black text-sm text-gray-800">
                          --:--
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
