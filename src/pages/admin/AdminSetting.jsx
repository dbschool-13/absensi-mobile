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
  Sun,
  Sunset,
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

  // State Form (Struktur Multi-Sesi)
  const [formData, setFormData] = useState({
    name: "",
    logo_url: "",
    working_days: [1, 2, 3, 4, 5],
    holidays: [],
    latitude: "",
    longitude: "",
    radius_meters: 50,
    enable_device_binding: false,
    time_rules: {
      is_sesi_2_active: false,
      sesi_1: {
        check_in_start: "",
        check_in_end: "",
        late_threshold: "",
        check_out_start: "",
        check_out_end: "",
        enable_late_status: false,
      },
      sesi_2: {
        check_in_start: "",
        check_in_end: "",
        late_threshold: "",
        check_out_start: "",
        check_out_end: "",
        enable_late_status: false,
      },
    },
  });

  const [holidayInput, setHolidayInput] = useState({
    date: "",
    description: "",
  });

  // Load Data Sekolah & Migrasi Struktur Lama ke Struktur Sesi Baru
  useEffect(() => {
    const fetchSettings = async () => {
      if (user?.school_id) {
        setLoading(true);
        const docSnap = await getDoc(doc(db, "schools", user.school_id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const oldTimeRules = data.time_rules || {};
          const hasSesi1 = !!oldTimeRules.sesi_1;

          setFormData({
            name: data.name || "",
            logo_url: data.logo_url || "",
            working_days: data.working_days || [1, 2, 3, 4, 5],
            holidays: data.holidays || [],
            latitude: data.latitude || "",
            longitude: data.longitude || "",
            radius_meters: data.radius_meters || 50,
            enable_device_binding: data.enable_device_binding || false,
            // Migrasi: Jika struktur baru belum ada, konversi data lama jadi Sesi 1
            time_rules: hasSesi1
              ? oldTimeRules
              : {
                  is_sesi_2_active: false,
                  sesi_1: {
                    check_in_start: oldTimeRules.check_in_start || "06:00",
                    check_in_end: oldTimeRules.check_in_end || "07:30",
                    check_out_start: oldTimeRules.check_out_start || "15:00",
                    check_out_end: oldTimeRules.check_out_end || "18:00",
                    enable_late_status: data.enable_late_status || false, // ambil dari struktur lama
                    late_threshold: oldTimeRules.late_threshold || "07:15",
                  },
                  sesi_2: {
                    check_in_start: "11:30",
                    check_in_end: "14:30",
                    check_out_start: "17:00",
                    check_out_end: "20:00",
                    enable_late_status: false,
                    late_threshold: "12:30",
                  },
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

  // Handler Jam Absensi Spesifik Sesi
  const handleSessionTimeChange = (sessionKey, field, value) => {
    setFormData((prev) => ({
      ...prev,
      time_rules: {
        ...prev.time_rules,
        [sessionKey]: {
          ...prev.time_rules[sessionKey],
          [field]: value,
        },
      },
    }));
  };

  // Handler Toggle Hari Kerja
  const toggleWorkingDay = (dayId) => {
    setFormData((prev) => {
      const currentDays = prev.working_days;
      if (currentDays.includes(dayId)) {
        if (currentDays.length === 1) {
          toast.error("Minimal harus ada 1 hari kerja!");
          return prev;
        }
        return {
          ...prev,
          working_days: currentDays.filter((d) => d !== dayId),
        };
      } else {
        return {
          ...prev,
          working_days: [...currentDays, dayId].sort((a, b) => a - b),
        };
      }
    });
  };

  // Handler Tambah/Hapus Hari Libur
  const handleAddHoliday = () => {
    if (!holidayInput.date) return toast.error("Harap pilih tanggal libur!");
    if (formData.holidays.some((h) => h.date === holidayInput.date))
      return toast.error("Tanggal ini sudah masuk di daftar libur!");

    setFormData((prev) => ({
      ...prev,
      holidays: [
        ...prev.holidays,
        {
          date: holidayInput.date,
          description: holidayInput.description || "Libur Nasional",
        },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setHolidayInput({ date: "", description: "" });
  };

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
      name: formData.name,
      logo_url: formData.logo_url,
      working_days: formData.working_days,
      holidays: formData.holidays,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      radius_meters: parseInt(formData.radius_meters),
      enable_device_binding: formData.enable_device_binding,
      time_rules: formData.time_rules, // Data multi-sesi masuk ke sini
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Pengaturan Sistem
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            Kelola identitas, waktu sesi, dan lokasi absensi.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary_dark px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
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

      {/* GRID UTAMA - Lebih Terstruktur */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        {/* ======================================= */}
        {/* BARIS 1: IDENTITAS & LOKASI             */}
        {/* ======================================= */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <School size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Identitas Sekolah</h3>
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

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <MapPin size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Lokasi & Radius GPS</h3>
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

        {/* ======================================= */}
        {/* BARIS 2: HARI KERJA & KEAMANAN          */}
        {/* ======================================= */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CalendarDays size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Hari Kerja Aktif</h3>
          </div>
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

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Keamanan</h3>
            </div>
          </div>
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100 h-[104px]">
            <div>
              <p className="font-bold text-gray-800">Device Binding</p>
              <p className="text-[11px] text-gray-500 mt-1 pr-2">
                Kunci 1 Akun Guru hanya untuk 1 Perangkat HP saja. Mencegah titip absen.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={formData.enable_device_binding}
                onChange={(e) =>
                  setFormData({ ...formData, enable_device_binding: e.target.checked })
                }
              />
              <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-700"></div>
            </label>
          </div>
        </div>

        {/* ======================================= */}
        {/* BARIS 3: WAKTU ABSENSI (MULTI-SESI)     */}
        {/* ======================================= */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 md:col-span-2">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Manajemen Waktu Sesi (Shift)</h3>
              <p className="text-xs text-gray-500 mt-0.5">Sistem otomatis mendeteksi sesi masuk pegawai berdasarkan jam saat mereka check-in.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* BLOK SESI 1 (PAGI) */}
            <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-100 relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md">
                  <Sun size={18} />
                </div>
                <h4 className="font-bold text-blue-800">Sesi 1 (Pagi)</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase">Jam Datang</p>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Mulai Buka</label>
                    <input
                      type="time"
                      value={formData.time_rules.sesi_1.check_in_start}
                      onChange={(e) => handleSessionTimeChange("sesi_1", "check_in_start", e.target.value)}
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Batas Akhir</label>
                    <input
                      type="time"
                      value={formData.time_rules.sesi_1.check_in_end}
                      onChange={(e) => handleSessionTimeChange("sesi_1", "check_in_end", e.target.value)}
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase">Jam Pulang</p>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Mulai Buka</label>
                    <input
                      type="time"
                      value={formData.time_rules.sesi_1.check_out_start}
                      onChange={(e) => handleSessionTimeChange("sesi_1", "check_out_start", e.target.value)}
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Batas Akhir</label>
                    <input
                      type="time"
                      value={formData.time_rules.sesi_1.check_out_end}
                      onChange={(e) => handleSessionTimeChange("sesi_1", "check_out_end", e.target.value)}
                      className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>
              </div>

              {/* Indikator Terlambat Sesi 1 */}
              <div className="mt-5 pt-4 border-t border-blue-100">
                <div className="flex justify-between items-center bg-white/70 p-3 rounded-xl border border-blue-100/50 shadow-sm">
                  <p className="font-bold text-blue-900 text-sm">Status Terlambat</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.time_rules.sesi_1.enable_late_status}
                      onChange={(e) => handleSessionTimeChange("sesi_1", "enable_late_status", e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-blue-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-blue-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                {formData.time_rules.sesi_1.enable_late_status && (
                  <div className="mt-3">
                    <label className="block text-[10px] text-blue-600 font-bold mb-1 uppercase">Batas Mulai Dihitung Terlambat</label>
                    <input
                      type="time"
                      value={formData.time_rules.sesi_1.late_threshold}
                      onChange={(e) => handleSessionTimeChange("sesi_1", "late_threshold", e.target.value)}
                      className="w-full bg-blue-100/50 border border-blue-200 text-blue-700 font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* BLOK SESI 2 (SIANG) */}
            <div className={`p-5 rounded-2xl border transition-all duration-300 ${formData.time_rules.is_sesi_2_active ? 'bg-orange-50/40 border-orange-100' : 'bg-gray-50 border-gray-200 grayscale opacity-70'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${formData.time_rules.is_sesi_2_active ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
                    <Sunset size={18} />
                  </div>
                  <h4 className={`font-bold ${formData.time_rules.is_sesi_2_active ? 'text-orange-800' : 'text-gray-500'}`}>Sesi 2 (Siang)</h4>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.time_rules.is_sesi_2_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, time_rules: { ...prev.time_rules, is_sesi_2_active: e.target.checked } }))}
                  />
                  <div className="w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>

              <div className={`transition-all duration-300 ${!formData.time_rules.is_sesi_2_active ? 'pointer-events-none' : ''}`}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">Jam Datang</p>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Mulai Buka</label>
                      <input
                        type="time"
                        value={formData.time_rules.sesi_2.check_in_start}
                        onChange={(e) => handleSessionTimeChange("sesi_2", "check_in_start", e.target.value)}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Batas Akhir</label>
                      <input
                        type="time"
                        value={formData.time_rules.sesi_2.check_in_end}
                        onChange={(e) => handleSessionTimeChange("sesi_2", "check_in_end", e.target.value)}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">Jam Pulang</p>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Mulai Buka</label>
                      <input
                        type="time"
                        value={formData.time_rules.sesi_2.check_out_start}
                        onChange={(e) => handleSessionTimeChange("sesi_2", "check_out_start", e.target.value)}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Batas Akhir</label>
                      <input
                        type="time"
                        value={formData.time_rules.sesi_2.check_out_end}
                        onChange={(e) => handleSessionTimeChange("sesi_2", "check_out_end", e.target.value)}
                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Indikator Terlambat Sesi 2 */}
                <div className="mt-5 pt-4 border-t border-orange-100">
                  <div className="flex justify-between items-center bg-white/70 p-3 rounded-xl border border-orange-100/50 shadow-sm">
                    <p className="font-bold text-orange-900 text-sm">Status Terlambat</p>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.time_rules.sesi_2.enable_late_status}
                        onChange={(e) => handleSessionTimeChange("sesi_2", "enable_late_status", e.target.checked)}
                      />
                      <div className="w-10 h-5 bg-orange-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-orange-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                  {formData.time_rules.sesi_2.enable_late_status && (
                    <div className="mt-3">
                      <label className="block text-[10px] text-orange-600 font-bold mb-1 uppercase">Batas Mulai Dihitung Terlambat</label>
                      <input
                        type="time"
                        value={formData.time_rules.sesi_2.late_threshold}
                        onChange={(e) => handleSessionTimeChange("sesi_2", "late_threshold", e.target.value)}
                        className="w-full bg-orange-100/50 border border-orange-200 text-orange-700 font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================= */}
        {/* BARIS 4: HARI LIBUR NASIONAL            */}
        {/* ======================================= */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 md:col-span-2">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <CalendarOff size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Hari Libur Sekolah / Nasional</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Tanggal yang ditambahkan ke sini tidak akan dihitung sebagai kewajiban hadir (tidak mengurangi persentase kehadiran).
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="date"
              value={holidayInput.date}
              onChange={(e) => setHolidayInput({ ...holidayInput, date: e.target.value })}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 md:w-1/4"
            />
            <input
              type="text"
              placeholder="Keterangan (Cth: HUT RI ke-81)"
              value={holidayInput.description}
              onChange={(e) => setHolidayInput({ ...holidayInput, description: e.target.value })}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={handleAddHoliday}
              className="bg-orange-100 text-orange-600 hover:bg-orange-200 px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} /> Tambah
            </button>
          </div>

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
                          {format(new Date(holiday.date), "dd MMM yyyy", { locale: id })}
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