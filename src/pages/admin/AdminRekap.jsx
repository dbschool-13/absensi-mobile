import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import {
  Download,
  FileText,
  Filter,
  Search,
  CalendarCheck,
} from "lucide-react";
import { format, eachDayOfInterval, endOfMonth } from "date-fns";

import { exportToPDF } from "../../utils/exportPdf";
import { exportToExcel } from "../../utils/exportExcel";

// Fungsi Helper untuk membagi hari dalam sebulan menjadi daftar Minggu Dinamis (Blok 7 Hari Tetap)
const getWorkingWeeks = (
  month,
  year,
  workingDays = [1, 2, 3, 4, 5],
  holidays = [],
) => {
  const start = new Date(year, parseInt(month) - 1, 1);
  const daysInMonth = endOfMonth(start).getDate();

  const weeks = [];

  // Format Standar Laporan Mingguan Instansi (Blok 7 Harian)
  const chunkRanges = [
    { id: 1, start: 1, end: 7 },
    { id: 2, start: 8, end: 14 },
    { id: 3, start: 15, end: 21 },
    { id: 4, start: 22, end: 28 },
    { id: 5, start: 29, end: 31 }, // Akan terpotong otomatis sesuai umur bulan
  ];

  chunkRanges.forEach((chunk) => {
    // Lewati Minggu ke-5 jika bulan tersebut hanya sampai tanggal 28 (misal Februari)
    if (chunk.start > daysInMonth) return;

    // Batasi hari terakhir sesuai umur bulan (misal tgl 30 atau 31)
    const chunkEnd = Math.min(chunk.end, daysInMonth);
    const currentWeekDays = [];

    // Loop hari dari tanggal mulai sampai tanggal akhir di minggu tersebut
    for (let i = chunk.start; i <= chunkEnd; i++) {
      const currentDay = new Date(year, parseInt(month) - 1, i);
      const dayOfWeek = currentDay.getDay();
      const dateStr = format(currentDay, "yyyy-MM-dd");
      const isHoliday = holidays.some((h) => h.date === dateStr);

      // Hanya masukkan ke array Export jika itu adalah Hari Kerja & Bukan Libur Nasional
      if (workingDays.includes(dayOfWeek) && !isHoliday) {
        currentWeekDays.push(currentDay);
      }
    }

    weeks.push({
      id: chunk.id,
      label: `Minggu ${chunk.id} (Tgl ${chunk.start} - ${chunkEnd})`,
      dates: currentWeekDays,
    });
  });

  return weeks;
};

export default function AdminRekap() {
  const { user, schoolData } = useAuth();
  const currentDate = new Date();

  const [selectedMonth, setSelectedMonth] = useState(format(currentDate, "MM"));
  const [selectedYear, setSelectedYear] = useState(format(currentDate, "yyyy"));
  const [selectedWeek, setSelectedWeek] = useState("all");
  const [selectedTeacher, setSelectedTeacher] = useState("all");

  const [teachers, setTeachers] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [rekapBulanan, setRekapBulanan] = useState([]);
  const [rekapMingguan, setRekapMingguan] = useState([]);
  const [loading, setLoading] = useState(false);

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
  const years = ["2025", "2026", "2027"];

  // ====================================================
  // LOGIKA SINKRONISASI HARI KERJA & HARI LIBUR
  // ====================================================
  const activeWorkingDaysDef = schoolData?.working_days || [1, 2, 3, 4, 5];
  const holidaysDef = schoolData?.holidays || [];

  // Hitung list minggu dinamis untuk filter
  const availableWeeks = useMemo(() => {
    return getWorkingWeeks(
      selectedMonth,
      selectedYear,
      activeWorkingDaysDef,
      holidaysDef,
    );
  }, [selectedMonth, selectedYear, activeWorkingDaysDef, holidaysDef]);

  // Hitung total HARI KERJA EFEKTIF dalam sebulan ini
  const totalHariKerjaBulanIni = useMemo(() => {
    let total = 0;
    availableWeeks.forEach((week) => {
      total += week.dates.length;
    });
    return total;
  }, [availableWeeks]);

  // Reset filter minggu ke 1 jika ganti bulan
  useEffect(() => {
    setSelectedWeek("all");
  }, [selectedMonth]);

  // Fetch Master Guru & Data Absen Bulanan
  useEffect(() => {
    const fetchMasterData = async () => {
      if (user?.school_id) {
        setTeachers(await adminService.getTeachers(user.school_id));

        setLoading(true);
        setAttendances(
          await adminService.getRekapData(
            user.school_id,
            selectedMonth,
            selectedYear,
          ),
        );
        setLoading(false);
      }
    };
    fetchMasterData();
  }, [user, selectedMonth, selectedYear]);

  // Kalkulasi Rekap (Bulanan & Mingguan Dinamis)
  useEffect(() => {
    if (teachers.length > 0) {
      const filteredTeachers =
        selectedTeacher === "all"
          ? teachers
          : teachers.filter((t) => t.nip === selectedTeacher);

      // Cek apakah filter minggu aktif atau "Semua"
      const targetWeek =
        selectedWeek === "all"
          ? null
          : availableWeeks.find((w) => w.id === parseInt(selectedWeek));

      // Tentukan Jumlah Hari Kerja yang jadi patokan (Seminggu atau Sebulan)
      const hariKerjaAktif = targetWeek
        ? targetWeek.dates.length
        : totalHariKerjaBulanIni;

      const rTabel = [];
      const rMingguan = []; // Untuk Export Excel

      filteredTeachers.forEach((guru) => {
        const absensiGuru = attendances.filter(
          (att) => att.user_id === guru.nip,
        );

        // Filter data absen HANYA untuk minggu yang dipilih (jika ada)
        const absensiAktif = targetWeek
          ? absensiGuru.filter((att) =>
              targetWeek.dates.some(
                (d) => format(d, "yyyy-MM-dd") === att.date,
              ),
            )
          : absensiGuru;

        // --- PROSES REKAP UNTUK TABEL LAYAR ---
        const totalHadir = absensiAktif.length;
        const totalJamKerjaRaw = absensiAktif.reduce(
          (sum, att) => sum + (att.total_hours || 0),
          0,
        );

        // Target jam dinamis mengikuti pilihan minggu/bulan
        const targetJam = hariKerjaAktif * 8;
        const selisihJamRaw = Math.max(targetJam - totalJamKerjaRaw, 0);

        const kurangJam = Math.floor(selisihJamRaw);
        const kurangMenit = Math.round((selisihJamRaw % 1) * 60);
        const teksKekurangan =
          selisihJamRaw > 0 ? `${kurangJam}j ${kurangMenit}m` : "Tuntas";

        const persentase =
          hariKerjaAktif === 0
            ? 0
            : Math.min(Math.round((totalHadir / hariKerjaAktif) * 100), 100);

        const tidakHadir = Math.max(hariKerjaAktif - totalHadir, 0);

        rTabel.push({
          nip: guru.nip,
          nama: guru.name,
          totalHadir,
          totalTidakHadir: tidakHadir,
          totalJamKerja: parseFloat(totalJamKerjaRaw.toFixed(1)),
          teksKekurangan,
          persentase,
        });

        // --- PROSES REKAP UNTUK EXCEL MINGGUAN ---
        if (targetWeek) {
          rMingguan.push({
            nip: guru.nip,
            nama: guru.name,
            absensiHarian: absensiAktif,
          });
        }
      });

      setRekapBulanan(rTabel.sort((a, b) => b.persentase - a.persentase));
      setRekapMingguan(rMingguan);
    }
  }, [
    attendances,
    teachers,
    selectedTeacher,
    selectedWeek,
    availableWeeks,
    totalHariKerjaBulanIni,
  ]);

  const handleExportPDF = () => {
    const monthLabel = months.find((m) => m.value === selectedMonth)?.label;
    exportToPDF(rekapBulanan, schoolData?.name, monthLabel, selectedYear);
  };

  const handleExportExcel = () => {
    const targetWeek = availableWeeks.find(
      (w) => w.id === parseInt(selectedWeek),
    );
    if (targetWeek) {
      exportToExcel(
        rekapMingguan,
        targetWeek.dates,
        schoolData?.name,
        targetWeek.label,
      );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Rekap Absensi
          </h1>
          <div className="flex items-center gap-2 mt-1 text-gray-500 font-medium">
            <CalendarCheck size={16} className="text-primary" />
            <span>
              Hari Kerja Efektif (
              {selectedWeek === "all" ? "Bulan Ini" : `Minggu ${selectedWeek}`}
              ):{" "}
              <strong>
                {selectedWeek === "all"
                  ? totalHariKerjaBulanIni
                  : availableWeeks.find((w) => w.id === parseInt(selectedWeek))
                      ?.dates.length || 0}{" "}
                Hari
              </strong>
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportExcel}
            disabled={rekapMingguan.length === 0}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2.5 rounded-xl font-bold transition-colors border border-emerald-200 disabled:opacity-50"
          >
            <FileText size={18} /> Export Excel (Mingguan)
          </button>
          <button
            onClick={handleExportPDF}
            disabled={rekapBulanan.length === 0}
            className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl font-bold transition-colors border border-red-200 disabled:opacity-50"
          >
            <Download size={18} /> Export PDF (Bulanan)
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-400 font-bold uppercase tracking-wider text-xs">
          <Filter size={18} /> Filter Laporan
        </div>

        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 outline-none text-sm font-semibold"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 outline-none text-sm font-semibold"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl py-2.5 px-4 outline-none text-gray-700"
        >
          {availableWeeks.length === 0 ? (
            <option value="">Tidak ada hari kerja</option>
          ) : (
            <>
              <option value="all">Semua Minggu (Sebulan)</option>
              {availableWeeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </>
          )}
        </select>

        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-sm font-semibold rounded-xl py-2.5 pl-10 pr-4 outline-none text-gray-700"
          >
            <option value="all">Semua Guru / Karyawan</option>
            {teachers.map((t) => (
              <option key={t.nip} value={t.nip}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABEL DATA BULANAN */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-5 text-center">No</th>
                <th className="p-5">Nama Pegawai</th> {/* Diubah */}
                <th className="p-5 text-center text-emerald-600">Hadir</th>
                <th className="p-5 text-center text-red-500">Tidak Hadir</th>
                <th className="p-5 text-center text-indigo-600">Total Jam</th>
                <th className="p-5 text-center text-orange-500">
                  Kekurangan Jam
                </th>{" "}
                {/* Kolom Baru */}
                <th className="p-5 text-center">Persentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-8 text-center text-gray-400 font-medium"
                  >
                    Memuat data...
                  </td>
                </tr>
              ) : rekapBulanan.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-8 text-center text-gray-400 font-medium"
                  >
                    Tidak ada data rekap untuk periode ini.
                  </td>
                </tr>
              ) : (
                rekapBulanan.map((row, idx) => (
                  <tr
                    key={row.nip}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-5 text-center text-gray-500 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="p-5">
                      <p className="font-bold text-gray-800">{row.nama}</p>
                      <p className="text-xs text-gray-400">NIP: {row.nip}</p>
                    </td>
                    <td className="p-5 text-center font-bold text-emerald-600">
                      {row.totalHadir}
                    </td>
                    <td className="p-5 text-center font-bold text-red-500">
                      {row.totalTidakHadir}
                    </td>
                    <td className="p-5 text-center font-bold text-indigo-600">
                      {row.totalJamKerja} Jam
                    </td>
                    <td
                      className={`p-5 text-center font-bold ${
                        row.teksKekurangan === "Tuntas"
                          ? "text-gray-400"
                          : "text-orange-500"
                      }`}
                    >
                      {row.teksKekurangan}
                    </td>
                    <td className="p-5 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          row.persentase >= 80
                            ? "bg-emerald-50 text-emerald-600"
                            : row.persentase >= 50
                            ? "bg-yellow-50 text-yellow-600"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {row.persentase}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
