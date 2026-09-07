import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import { db } from "../../services/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Users, CheckCircle2, XCircle, Clock } from "lucide-react";

// Helper untuk membaca waktu dari Firebase Timestamp ATAU ISO String (Suntikan Izin)
const getValidTime = (timeData) => {
  if (!timeData) return 0;
  // Jika formatnya Timestamp dari Firebase
  if (typeof timeData.toDate === "function") {
    return timeData.toDate().getTime();
  }
  // Jika formatnya String ISO dari sistem suntik absen
  return new Date(timeData).getTime();
};

export default function AdminMonitoring() {
  const { user } = useAuth();

  const [teachers, setTeachers] = useState([]);
  const [realtimeAtt, setRealtimeAtt] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // ==========================================================
  // PERBAIKAN LOGIKA PEMBACAAN STATUS IZIN (AUTO-INJECT)
  // ==========================================================
  const monitoringData = teachers
    .map((guru) => {
      const absenHariIni = realtimeAtt.find((att) => att.user_id === guru.nip);

      // Definisikan status default
      let isHadir = false;
      let isAutoInject = false;

      if (absenHariIni) {
        const note = (absenHariIni.notes || "").toUpperCase();
        isAutoInject = note.includes("[AUTO-INJECT");

        // Dianggap "Ada Kejelasan Status" jika: punya check_in ATAU disuntik sistem (izin/cuti)
        isHadir = !!absenHariIni.check_in || isAutoInject;
      }

      return {
        ...guru,
        absen: absenHariIni || null,
        isHadirRecord: isHadir,
        isAutoInject: isAutoInject,
      };
    })
    .sort((a, b) => {
      // Urutkan: Yang sudah hadir/izin di atas, yang belum datang di bawah
      if (a.isHadirRecord && !b.isHadirRecord) return -1;
      if (!a.isHadirRecord && b.isHadirRecord) return 1;

      // Jika keduanya ada record, urutkan berdasarkan jam datang (jika ada)
      if (
        a.isHadirRecord &&
        b.isHadirRecord &&
        a.absen?.check_in &&
        b.absen?.check_in
      ) {
        const timeA = getValidTime(a.absen.check_in.time);
        const timeB = getValidTime(b.absen.check_in.time);
        return timeB - timeA;
      }
      return a.name.localeCompare(b.name);
    });

  const totalPegawai = teachers.length;
  // Yang dihitung "Sudah Hadir" di kotak atas adalah mereka yang benar-benar absen (bukan yang 0 Jam)
  const totalHadir = realtimeAtt.filter(
    (att) =>
      !att.notes?.includes("[AUTO-INJECT: SAKIT]") &&
      !att.notes?.includes("[AUTO-INJECT: IZIN PRIBADI]"),
  ).length;
  const totalBelum = totalPegawai - totalHadir;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-red-500 font-bold text-xs uppercase tracking-widest">
              Live Monitoring
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Pantau Kehadiran
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            {format(currentTime, "EEEE, dd MMMM yyyy", { locale: id })}
          </p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <Clock size={24} className="text-primary" />
          <span className="text-2xl font-black text-gray-800 tracking-wider">
            {format(currentTime, "HH:mm:ss")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-500">
            <Users size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total Pegawai
            </p>
            <h3 className="text-3xl font-black text-gray-800">
              {totalPegawai}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Total Terdata
            </p>
            <h3 className="text-3xl font-black text-gray-800">{totalHadir}</h3>
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <CheckCircle2 size={60} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5 relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-50 text-red-500">
            <XCircle size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Belum Terdata
            </p>
            <h3 className="text-3xl font-black text-gray-800">{totalBelum}</h3>
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <XCircle size={60} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/40 border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-5 w-16 text-center">No</th>
                <th className="p-5">Nama Pegawai / Role</th>
                <th className="p-5 text-center">Jam Datang</th>
                <th className="p-5 text-center">Jam Pulang</th>
                <th className="p-5 text-center">Status Terkini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    className="p-8 text-center text-gray-400 font-medium animate-pulse"
                  >
                    Menghubungkan ke Server Live...
                  </td>
                </tr>
              ) : (
                monitoringData.map((data, idx) => {
                  const att = data.absen;
                  const isHadir = !!att?.check_in;
                  const isPulang = !!att?.check_out;
                  const isAutoInject = data.isAutoInject;
                  const note = (att?.notes || "").toUpperCase();

                  let statusBadge = (
                    <span className="bg-red-50 text-red-500 px-3 py-1.5 rounded-full text-xs font-bold border border-red-100">
                      Belum Datang
                    </span>
                  );
                  let inTime = "--:--";
                  let outTime = "--:--";
                  let isTargetMet = false;

                  if (att) {
                    if (isAutoInject) {
                      // LOGIKA KHUSUS UNTUK YANG IZIN/CUTI
                      if (note.includes("CUTI")) {
                        statusBadge = (
                          <span className="bg-purple-100 text-purple-600 px-3 py-1.5 rounded-full text-xs font-bold border border-purple-200">
                            Cuti
                          </span>
                        );
                        inTime = "07:00";
                        outTime = "15:00";
                        isTargetMet = true;
                      } else if (note.includes("SAKIT")) {
                        statusBadge = (
                          <span className="bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-200">
                            Sakit
                          </span>
                        );
                      } else if (note.includes("IZIN KEDINASAN")) {
                        statusBadge = (
                          <span className="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-200">
                            Izin Kedinasan
                          </span>
                        );
                        inTime = "07:00";
                        outTime = "15:00";
                        isTargetMet = true;
                      } else if (note.includes("IZIN")) {
                        statusBadge = (
                          <span className="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-200">
                            Izin Pribadi
                          </span>
                        );
                      }
                    } else if (isHadir) {
                      // LOGIKA NORMAL UNTUK YANG HADIR FISIK
                      inTime = format(getValidTime(att.check_in.time), "HH:mm");
                      isTargetMet =
                        att.status === "Memenuhi Target" ||
                        att.total_hours >= 8;

                      if (isPulang) {
                        outTime = format(
                          getValidTime(att.check_out.time),
                          "HH:mm",
                        );
                        statusBadge = (
                          <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200">
                            Selesai
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200 flex items-center justify-center w-fit mx-auto gap-1">
                            Sedang Bekerja{" "}
                            <span className="flex h-2 w-2 ml-1 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          </span>
                        );
                      }
                    }
                  }

                  return (
                    <tr
                      key={data.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-5 text-center font-semibold text-gray-500">
                        {idx + 1}
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-gray-800">{data.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                          {data.role === "kepsek"
                            ? "Kepala Sekolah"
                            : data.role === "tendik"
                            ? "Tenaga Kependidikan"
                            : "Guru"}
                        </p>
                      </td>
                      <td className="p-5 text-center">
                        <span
                          className={`font-bold ${
                            isAutoInject && inTime === "--:--"
                              ? "text-orange-500"
                              : isHadir || isAutoInject
                              ? "text-emerald-600"
                              : "text-gray-300 font-medium"
                          }`}
                        >
                          {inTime}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`font-bold ${
                              isAutoInject && outTime === "--:--"
                                ? "text-orange-500"
                                : isPulang || isAutoInject
                                ? "text-indigo-600"
                                : "text-gray-300 font-medium"
                            }`}
                          >
                            {outTime}
                          </span>
                          {/* Hanya tampilkan label Target/Kurang Jam jika ada jam pulangnya */}
                          {outTime !== "--:--" && (
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                                isTargetMet
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : "bg-red-50 text-red-500 border-red-100"
                              }`}
                            >
                              {isTargetMet ? "Memenuhi Target" : "Kurang Jam"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-5 text-center">{statusBadge}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
