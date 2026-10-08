import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { attendanceService } from "../../services/attendanceService";
import {
  Calendar,
  Clock,
  Target,
  ChevronDown,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import { id } from "date-fns/locale";

// =================================================================
// HELPER: LOGIKA MINGGU KERJA (SINKRON 100% DENGAN ADMIN REKAP)
// =================================================================
const getWorkingWeeks = (
  month,
  year,
  workingDays = [1, 2, 3, 4, 5],
  holidays = [],
) => {
  const weeks = [];
  const firstDayOfMonth = new Date(year, parseInt(month) - 1, 1);
  let currentMonday = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
  let weekId = 1;

  while (
    (currentMonday.getMonth() <= parseInt(month) - 1 &&
      currentMonday.getFullYear() == year) ||
    weekId === 1
  ) {
    if (weekId > 1 && currentMonday.getMonth() !== parseInt(month) - 1) break;

    const currentWeekDays = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = addDays(currentMonday, i);
      const dayOfWeek = currentDay.getDay();
      const dateStr = format(currentDay, "yyyy-MM-dd");
      const isHoliday = holidays.some((h) => h.date === dateStr);

      if (workingDays.includes(dayOfWeek) && !isHoliday) {
        currentWeekDays.push(currentDay);
      }
    }

    if (currentWeekDays.length > 0) {
      weeks.push({
        id: weekId,
        label: `Minggu ${weekId}`,
        dates: currentWeekDays,
      });
    }

    currentMonday = addDays(currentMonday, 7);
    weekId++;
  }
  return weeks;
};

// Helper aman memformat waktu, langsung menerima label izin dari logika utama
const formatTimeSafe = (timeData, injectLabel) => {
  if (!timeData) return "--:--";

  if (
    timeData === "[AUTO-INJECT]" ||
    (typeof timeData === "string" && timeData.includes("AUTO-INJECT"))
  ) {
    return injectLabel || "Izin Disetujui";
  }

  try {
    const dateObj = timeData?.toDate ? timeData.toDate() : new Date(timeData);
    if (isNaN(dateObj.getTime())) return "--:--";
    return format(dateObj, "HH:mm");
  } catch (e) {
    return "--:--";
  }
};

export default function Riwayat() {
  const { user, schoolData } = useAuth();
  const currentDate = new Date();

  // State Filter
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

  // Aturan Hari Kerja & Libur dari Master Data
  const activeWorkingDaysDef = schoolData?.working_days || [1, 2, 3, 4, 5];
  const holidaysDef = schoolData?.holidays || [];

  // Kalkulasi Minggu & Hari Aktif (Sinkron dengan Admin)
  const availableWeeks = useMemo(() => {
    return getWorkingWeeks(
      selectedMonth,
      selectedYear,
      activeWorkingDaysDef,
      holidaysDef,
    );
  }, [selectedMonth, selectedYear, activeWorkingDaysDef, holidaysDef]);

  const totalHariKerjaBulanIni = useMemo(() => {
    let total = 0;
    availableWeeks.forEach((week) => (total += week.dates.length));
    return total;
  }, [availableWeeks]);

  // ============================================================
  // FETCH DATA: PARALLEL LINTAS BULAN (SINKRON ADMIN REKAP)
  // ============================================================
  useEffect(() => {
    const fetchHistory = async () => {
      if (user?.school_id && availableWeeks.length > 0) {
        setLoading(true);

        // Deteksi jika minggu kerja melintasi 2 bulan yang berbeda
        const uniqueMonthsYears = [
          ...new Set(
            availableWeeks.flatMap((w) =>
              w.dates.map((d) => format(d, "MM-yyyy")),
            ),
          ),
        ];

        // Tarik data paralel untuk semua bulan yang terlibat
        const fetchPromises = uniqueMonthsYears.map((monthYear) => {
          const [m, y] = monthYear.split("-");
          return attendanceService.getHistory(user.nip, user.school_id, m, y);
        });

        const resultsArray = await Promise.all(fetchPromises);
        const combinedAttendances = resultsArray.flat();

        // Buang data duplikat (jika ada overlap)
        const uniqueAttendances = Array.from(
          new Map(combinedAttendances.map((item) => [item.id, item])).values(),
        );

        // HANYA ambil absensi yang masuk di dalam tanggal aktif (allValidDates)
        const allValidDates = new Set(
          availableWeeks.flatMap((w) =>
            w.dates.map((d) => format(d, "yyyy-MM-dd")),
          ),
        );

        const absensiAktif = uniqueAttendances.filter((att) =>
          allValidDates.has(att.date),
        );

        // Urutkan dari yang terbaru
        absensiAktif.sort((a, b) => b.date.localeCompare(a.date));

        setHistory(absensiAktif);
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, availableWeeks]);

  // ============================================================
  // KALKULASI METRIK (Total Jam, Kehadiran %, Kinerja %)
  // ============================================================
  const summary = useMemo(() => {
    let countHadir = 0;
    let totalJamKerjaRaw = 0;

    history.forEach((att) => {
      const isAutoInject =
        att.is_auto_injected === true || att.check_in?.time === "[AUTO-INJECT]";

      if (isAutoInject) {
        const statusVal = (att.status || "").toLowerCase();
        if (
          !(
            statusVal === "cuti" ||
            statusVal === "sakit" ||
            statusVal.includes("izin")
          )
        ) {
          countHadir++;
        }
      } else {
        countHadir++;
      }

      totalJamKerjaRaw += att.total_hours || 0;
    });

    const targetJam = totalHariKerjaBulanIni * 8;
    const persentaseKinerja =
      targetJam === 0
        ? 0
        : Math.min(Math.round((totalJamKerjaRaw / targetJam) * 100), 100);
        
    const persentaseKehadiran =
      totalHariKerjaBulanIni === 0
        ? 0
        : Math.round((countHadir / totalHariKerjaBulanIni) * 100);

    return {
      totalJamDisplay: parseFloat(totalJamKerjaRaw.toFixed(1)),
      persentaseKehadiran,
      persentaseKinerja,
    };
  }, [history, totalHariKerjaBulanIni]);

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

      {/* ======================================================== */}
      {/* SUMMARY STATS (METRIK REKAP) SECTION */}
      {/* ======================================================== */}
      <div className="px-5 mt-5 grid grid-cols-3 gap-3">
        {/* Total Jam */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <Clock size={20} className="text-indigo-500 mb-1" />
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">
            Total Jam
          </span>
          <span className="text-sm font-black text-indigo-700">
            {summary.totalJamDisplay}
          </span>
        </div>
        {/* Kehadiran */}
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <CalendarCheck size={20} className="text-teal-500 mb-1" />
          <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wide">
            Kehadiran
          </span>
          <span className="text-sm font-black text-teal-700">
            {summary.persentaseKehadiran}%
          </span>
        </div>
        {/* Kinerja */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
          <Target size={20} className="text-emerald-500 mb-1" />
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">
            Jam Kerja
          </span>
          <span className="text-sm font-black text-emerald-700">
            {summary.persentaseKinerja}%
          </span>
        </div>
      </div>

      {/* LIST RIWAYAT SECTION */}
      <div className="px-5 mt-6 space-y-4">
        {loading ? (
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
          history.map((item) => {
            const dateObj = parseISO(item.date);

            const isAutoInject =
              item.is_auto_injected === true ||
              item.check_in?.time === "[AUTO-INJECT]";
            const isCompleted =
              item.status === "Memenuhi Target" || item.total_hours >= 8;

            let badgeLabel = "";
            let badgeClass = "";

            if (isAutoInject) {
              const statusVal = (item.status || "").toLowerCase();
              if (statusVal === "cuti") {
                badgeLabel = "Cuti";
                badgeClass = "bg-purple-50 text-purple-600 border-purple-200";
              } else if (statusVal === "sakit") {
                badgeLabel = "Sakit";
                badgeClass = "bg-orange-50 text-orange-600 border-orange-200";
              } else if (statusVal === "izin_kedinasan") {
                badgeLabel = "Izin Kedinasan";
                badgeClass = "bg-blue-50 text-blue-600 border-blue-200";
              } else if (
                statusVal === "izin_pribadi" ||
                statusVal.includes("izin")
              ) {
                badgeLabel = "Izin Pribadi";
                badgeClass = "bg-blue-50 text-blue-600 border-blue-200";
              } else {
                badgeLabel =
                  statusVal
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ") || "Izin Disetujui";
                badgeClass =
                  "bg-emerald-50 text-emerald-600 border-emerald-200";
              }
            } else {
              if (!item.check_out) {
                badgeLabel = "Belum Pulang";
                badgeClass = "bg-blue-50 text-blue-600 border-blue-200";
              } else if (isCompleted) {
                badgeLabel = "Memenuhi Target";
                badgeClass =
                  "bg-emerald-50 text-emerald-600 border-emerald-200";
              } else {
                badgeLabel = "Belum Memenuhi Target";
                badgeClass = "bg-red-50 text-red-600 border-red-200";
              }
            }

            let shortText = null;
            if (
              item.check_out &&
              !isCompleted &&
              item.total_hours < 8 &&
              !isAutoInject
            ) {
              const targetMinutes = 8 * 60;
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
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}
                  >
                    {badgeLabel}
                  </div>
                </div>

                {/* Info Jam */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                      <Clock size={16} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">
                        Masuk
                      </p>
                      <p className="font-bold text-gray-800">
                        {formatTimeSafe(item.check_in?.time, badgeLabel)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
                      <Clock size={16} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase">
                        Pulang
                      </p>
                      <p className="font-bold text-gray-800">
                        {formatTimeSafe(item.check_out?.time, badgeLabel)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Jam Kerja & Kekurangan */}
                {item.check_out && (
                  <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1 mt-1 border border-gray-100">
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