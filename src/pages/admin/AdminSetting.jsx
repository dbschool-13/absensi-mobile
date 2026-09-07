import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import { db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  Save,
  School,
  MapPin,
  Clock,
  CalendarDays,
  CalendarOff,
  Plus,
  Trash2,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function AdminSetting() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Definisi Master Hari
  const MASTER_DAYS = [
    { id: 1, label: "Senin" },
    { id: 2, label: "Selasa" },
    { id: 3, label: "Rabu" },
    { id: 4, label: "Kamis" },
    { id: 5, label: "Jumat" },
    { id: 6, label: "Sabtu" },
  ];

  // State Form
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    working_days: [1, 2, 3, 4, 5], // Default Senin-Jumat
    holidays: [], // Format: [{ date: '2026-08-17', description: 'HUT RI' }]
    latitude: "",
    longitude: "",
    radius_meters: 50,
    time_rules: {
      check_in_start: "",
      check_in_end: "",
      check_out_start: "",
      check_out_end: "",
    },
  });

  // State Input Hari Libur Baru
  const [holidayInput, setHolidayInput] = useState({
    date: "",
    description: "",
  });

  // Load Data Sekolah
  useEffect(() => {
    const fetchSettings = async () => {
      if (user?.school_id) {
        setLoading(true);
        const docSnap = await getDoc(doc(db, "schools", user.school_id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            name: data.name || "",
            logo_url: data.logo_url || "",
            working_days: data.working_days || [1, 2, 3, 4, 5],
            holidays: data.holidays || [],
            enable_device_binding: data.enable_device_binding || false,
            latitude: data.latitude || "",
            longitude: data.longitude || "",
            radius_meters: data.radius_meters || 50,
            time_rules: data.time_rules || {
              check_in_start: "06:00",
              check_in_end: "07:30",
              check_out_start: "15:00",
              check_out_end: "18:00",
            },
          });
        }
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  // Handler Teks Dasar
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handler Jam Absensi
  const handleTimeChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      time_rules: { ...prev.time_rules, [name]: value },
    }));
  };

  // Handler Toggle Hari Kerja
  const toggleWorkingDay = (dayId) => {
    setFormData((prev) => {
      const currentDays = prev.working_days;
      if (currentDays.includes(dayId)) {
        // Hapus hari jika sudah ada (kecuali jika itu hari terakhir yang tersisa)
        if (currentDays.length === 1) {
          toast.error("Minimal harus ada 1 hari kerja!");
          return prev;
        }
        return {
          ...prev,
          working_days: currentDays.filter((d) => d !== dayId),
        };
      } else {
        // Tambahkan hari dan urutkan
        return {
          ...prev,
          working_days: [...currentDays, dayId].sort((a, b) => a - b),
        };
      }
    });
  };

  // Handler Tambah Hari Libur
  const handleAddHoliday = () => {
    if (!holidayInput.date) {
      toast.error("Harap pilih tanggal libur!");
      return;
    }

    // Cek apakah tanggal sudah ada
    const isExist = formData.holidays.some((h) => h.date === holidayInput.date);
    if (isExist) {
      toast.error("Tanggal ini sudah masuk di daftar libur!");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      holidays: [
        ...prev.holidays,
        {
          date: holidayInput.date,
          description: holidayInput.description || "Libur Nasional",
        },
      ].sort((a, b) => a.date.localeCompare(b.date)), // Urutkan dari tanggal terlama
    }));

    setHolidayInput({ date: "", description: "" }); // Reset input
  };

  // Handler Hapus Hari Libur
  const handleRemoveHoliday = (dateStr) => {
    setFormData((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h.date !== dateStr),
    }));
  };

  // Handler Simpan Semua Data
  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...formData,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      radius_meters: parseInt(formData.radius_meters),
    };

    const success = await adminService.updateSchoolSettings(
      user.school_id,
      payload,
    );

    if (success) {
      toast.success("Pengaturan berhasil disimpan!");
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error("Gagal menyimpan pengaturan.");
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">Memuat pengaturan...</div>
    );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Pengaturan Sistem
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            Kelola identitas, waktu, dan lokasi absensi.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-white hover:bg-primary_dark px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
        >
          {saving ? (
            <span className="animate-pulse">Menyimpan...</span>
          ) : (
            <>
              <Save size={20} /> Simpan Perubahan
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* 1. Identitas Sekolah */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <School size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">
              Identitas Sekolah
            </h3>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
              Nama Sekolah / Instansi
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
              URL Logo Sekolah
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                placeholder="https://..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none"
              />
              {formData.logo_url && (
                <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-1 flex-shrink-0">
                  <img
                    src={formData.logo_url}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Lokasi GPS & Radius */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <MapPin size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">
              Lokasi & Radius GPS
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
              Radius Area (Meter)
            </label>
            <input
              type="number"
              name="radius_meters"
              value={formData.radius_meters}
              onChange={handleChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>

        {/* 3. Sistem Hari Kerja (Multi-Select) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CalendarDays size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">
              Hari Kerja Aktif
            </h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Klik untuk mengaktifkan atau menonaktifkan hari kerja.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {MASTER_DAYS.map((day) => {
              const isActive = formData.working_days.includes(day.id);
              return (
                <button
                  key={day.id}
                  onClick={() => toggleWorkingDay(day.id)}
                  className={`py-3 rounded-xl font-bold transition-all border-2 ${
                    isActive
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                      : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Waktu Absensi */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Waktu Absensi</h3>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">
                Jam Datang
              </p>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  Mulai Buka
                </label>
                <input
                  type="time"
                  name="check_in_start"
                  value={formData.time_rules.check_in_start}
                  onChange={handleTimeChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  Batas Akhir
                </label>
                <input
                  type="time"
                  name="check_in_end"
                  value={formData.time_rules.check_in_end}
                  onChange={handleTimeChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">
                Jam Pulang
              </p>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  Mulai Buka
                </label>
                <input
                  type="time"
                  name="check_out_start"
                  value={formData.time_rules.check_out_start}
                  onChange={handleTimeChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">
                  Batas Akhir
                </label>
                <input
                  type="time"
                  name="check_out_end"
                  value={formData.time_rules.check_out_end}
                  onChange={handleTimeChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 6. Sistem Keamanan (Device Binding) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 md:col-span-2">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Keamanan Anti-Titip Absen
              </h3>
              <p className="text-sm text-gray-500">
                Kunci 1 Akun Guru hanya untuk 1 Perangkat HP saja.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div>
              <p className="font-bold text-gray-800">
                Device Binding (Pengikatan Perangkat)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Jika aktif, guru tidak bisa login dari HP yang berbeda dari saat
                pertama login.
              </p>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.enable_device_binding}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enable_device_binding: e.target.checked,
                  })
                }
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        {/* 5. Hari Libur Sekolah / Nasional */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 md:col-span-2">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <CalendarOff size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">
              Hari Libur Sekolah / Nasional
            </h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Tanggal yang ditambahkan ke sini tidak akan dihitung sebagai
            kewajiban hadir (tidak mengurangi persentase kehadiran).
          </p>

          {/* Form Tambah Libur */}
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="date"
              value={holidayInput.date}
              onChange={(e) =>
                setHolidayInput({ ...holidayInput, date: e.target.value })
              }
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 md:w-1/4"
            />
            <input
              type="text"
              placeholder="Keterangan (Cth: HUT RI ke-81)"
              value={holidayInput.description}
              onChange={(e) =>
                setHolidayInput({
                  ...holidayInput,
                  description: e.target.value,
                })
              }
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={handleAddHoliday}
              className="bg-orange-100 text-orange-600 hover:bg-orange-200 px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Tambah
            </button>
          </div>

          {/* List Hari Libur */}
          <div className="mt-6">
            {formData.holidays.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm font-medium">
                Belum ada hari libur yang ditambahkan.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {formData.holidays.map((holiday) => (
                  <div
                    key={holiday.date}
                    className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex justify-between items-center group"
                  >
                    <div className="flex gap-3 items-center">
                      <div className="bg-white p-2 rounded-lg shadow-sm text-orange-500">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {format(new Date(holiday.date), "dd MMM yyyy", {
                            locale: id,
                          })}
                        </p>
                        <p className="text-xs text-gray-500 font-medium line-clamp-1">
                          {holiday.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveHoliday(holiday.date)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-white rounded-lg opacity-0 group-hover:opacity-100 shadow-sm"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
