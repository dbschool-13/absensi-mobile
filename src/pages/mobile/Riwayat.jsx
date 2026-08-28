import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { attendanceService } from "../../services/attendanceService";
import {
  Calendar,
  Clock,
  Target,
  ChevronDown,
  AlertCircle,
} from "lucide-react"; // <-- Tambah AlertCircle
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

export default function Riwayat() {
  const { user } = useAuth();
  const currentDate = new Date();

  // State Filter (Default: Bulan & Tahun saat ini)
  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, "MM"));
  const [selectedYear, setSelectedYear] = useState(format(currentDate, "yyyy"));

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generate Opsi Bulan & Tahun
  const months = [
    { value: "01", label: "Januari" },
    { value: "02", label: "Februari" },
    { value: "03", label: "Maret" },
    { value: "04", label: "April" },
    { value: "05", label: "Mei" },
    { value: "06", label: "Juni" },
    { value: "07", label: "Juli" },
    { value: "08", label: "Agustus" },
    { value: "09", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

  const currentYear = parseInt(format(currentDate, "yyyy"));
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Fetch Data setiap kali Bulan/Tahun berubah
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      if (user) {
        const data = await attendanceService.getHistory(
          user.nip,
          selectedMonth,
          selectedYear,
        );
        setHistory(data);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [user, selectedMonth, selectedYear]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-b from-primary to-primary_dark text-white pt-10 pb-16 px-6 rounded-b-[2.5rem] shadow-lg relative">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Riwayat</h1>
            <p className="text-xs text-indigo-200 mt-1">
              Catatan Kehadiran Anda
            </p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-2xl backdrop-blur-md flex items-center justify-center border border-white/20">
            <Calendar size={24} className="text-white" />
          </div>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="-mt-8 mx-5 bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-4 relative z-20 border border-gray-100 flex gap-3">
        {/* Dropdown Bulan */}
        <div className="flex-1 relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl py-3 pl-4 pr-10 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>

        {/* Dropdown Tahun */}
        <div className="w-1/3 relative">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl py-3 pl-4 pr-10 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          >
            {years.map((y) => (
              <option key={y} value={y.toString()}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      {/* LIST RIWAYAT SECTION */}
      <div className="px-5 mt-6 space-y-4">
        {loading ? (
          // Skeleton Loading
          [1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="flex justify-between">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))
        ) : history.length === 0 ? (
          // Empty State
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-200/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-gray-400" />
            </div>
            <h3 className="text-gray-800 font-bold">Belum Ada Catatan</h3>
            <p className="text-sm text-gray-500 mt-1">
              Tidak ada data absensi di bulan ini.
            </p>
          </div>
        ) : (
          // List Item
          history.map((item) => {
            const dateObj = parseISO(item.date);
            const isCompleted = item.status === "Memenuhi Target";

            // Logika Menghitung Kekurangan Jam (jika sudah pulang dan kurang dari 8 jam)
            let shortText = null;
            if (item.check_out && !isCompleted && item.total_hours < 8) {
              const targetMinutes = 8 * 60; // 480 menit
              const workedMinutes = Math.round(item.total_hours * 60);
              const shortfall = targetMinutes - workedMinutes;

              if (shortfall > 0) {
                const shortH = Math.floor(shortfall / 60);
                const shortM = shortfall % 60;
                shortText = `Kurang ${
                  shortH > 0 ? `${shortH}j ` : ""
                }${shortM}m`;
              }
            }

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-4"
              >
                {/* Tanggal & Status */}
                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                      {format(dateObj, "EEEE", { locale: id })}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {format(dateObj, "dd MMM yyyy", { locale: id })}
                    </span>
                  </div>

                  <div
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isCompleted
                        ? "bg-emerald-50 text-emerald-600"
                        : item.status === "Belum Pulang"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {item.status}
                  </div>
                </div>

                {/* Info Jam */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                      <Clock size={16} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">
                        Masuk
                      </p>
                      <p className="font-bold text-gray-800">
                        {item.check_in
                          ? format(
                              item.check_in.time?.toDate
                                ? item.check_in.time.toDate()
                                : new Date(item.check_in.time),
                              "HH:mm",
                            )
                          : "--:--"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                      <Clock size={16} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">
                        Pulang
                      </p>
                      <p className="font-bold text-gray-800">
                        {item.check_out
                          ? format(
                              item.check_out.time?.toDate
                                ? item.check_out.time.toDate()
                                : new Date(item.check_out.time),
                              "HH:mm",
                            )
                          : "--:--"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Jam Kerja & Kekurangan */}
                {item.check_out && (
                  <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1 mt-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Target size={14} />
                        <span className="text-xs font-semibold">
                          Total Durasi
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-800">
                        {Math.floor(item.total_hours)} Jam{" "}
                        {Math.round((item.total_hours % 1) * 60)} Menit
                      </span>
                    </div>

                    {/* BAGIAN TAMBAHAN: Muncul hanya jika kurang dari target */}
                    {shortText && (
                      <div className="flex justify-end items-center gap-1.5 mt-0.5">
                        <AlertCircle size={12} className="text-orange-500" />
                        <span className="text-[11px] font-bold text-orange-500">
                          {shortText}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
