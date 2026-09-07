import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { leaveService } from "../../services/leaveService";
import toast from "react-hot-toast";
import {
  Calendar,
  FileText,
  Image as ImageIcon,
  Send,
  History,
  Clock,
  CheckCircle,
  XCircle,
  Info,
  Briefcase,
  User as UserIcon,
  Stethoscope,
  Plane,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// Helper Kompresi Gambar: Mengecilkan ukuran foto agar muat di Database Firestore
const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800; // Maksimal resolusi
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        // Proporsi skala otomatis
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Kompres menjadi JPEG dengan kualitas 60%
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function PengajuanIzin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("form"); // "form" atau "riwayat"

  // STATE FORMULIR
  const [type, setType] = useState("izin_pribadi");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // STATE RIWAYAT & OFFLINE
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  // Sensor Internet
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cek antrean offline saat pertama buka
    const queue = JSON.parse(localStorage.getItem("offline_leaves") || "[]");
    setPendingSync(queue.length);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Tarik riwayat saat pindah tab
  useEffect(() => {
    if (activeTab === "riwayat" && !isOffline) {
      fetchHistory();
    }
  }, [activeTab, isOffline]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const data = await leaveService.getUserHistory(user.nip);
    setHistory(data);
    setLoadingHistory(false);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran gambar maksimal 2MB!");
        return;
      }
      const base64 = await convertToBase64(file);
      setAttachment(base64);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // PERBAIKAN: Semua wajib diisi, termasuk dokumen pendukung!
    if (!startDate || !endDate || !reason) {
      return toast.error("Harap lengkapi tanggal dan alasan!");
    }
    if (new Date(startDate) > new Date(endDate)) {
      return toast.error("Tanggal akhir tidak boleh mendahului tanggal mulai!");
    }
    if (!attachment) {
      return toast.error("Dokumen/Foto bukti WAJIB dilampirkan!");
    }

    setIsSubmitting(true);

    try {
      if (isOffline) {
        // SIMPAN KE OFFLINE QUEUE
        const payload = {
          id: Date.now().toString(),
          nip: user.nip,
          school_id: user.school_id,
          type,
          start_date: startDate,
          end_date: endDate,
          reason,
          attachment,
        };

        const queue = JSON.parse(
          localStorage.getItem("offline_leaves") || "[]",
        );
        queue.push(payload);
        localStorage.setItem("offline_leaves", JSON.stringify(queue));

        setPendingSync(queue.length);
        toast.success(
          "📶 Offline: Pengajuan disimpan di HP. Akan dikirim otomatis saat sinyal stabil.",
        );

        resetForm();
        setActiveTab("riwayat");
      } else {
        // KIRIM ONLINE KE SERVER
        const success = await leaveService.submitLeaveRequest(
          user.nip,
          user.school_id,
          type,
          startDate,
          endDate,
          reason,
          attachment,
        );

        if (success) {
          setShowSuccessModal(true);
          fetchHistory();
        } else {
          toast.error("Gagal mengirim pengajuan. Coba lagi.");
        }
      }
    } catch (error) {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setType("izin_pribadi");
    setStartDate("");
    setEndDate("");
    setReason("");
    setAttachment(null);
    setAttachmentPreview(null);
  };

  const handleCloseModal = () => {
    setShowSuccessModal(false);
    resetForm();
    setActiveTab("riwayat");
  };

  // Konfigurasi Info Jenis Pengajuan
  const leaveTypes = [
    {
      id: "izin_pribadi",
      label: "Izin Pribadi",
      icon: UserIcon,
      color: "text-orange-500",
      bg: "bg-orange-50",
      info: "Tidak dihitung jam kerja (0 Jam)",
    },
    {
      id: "izin_kedinasan",
      label: "Izin Kedinasan",
      icon: Briefcase,
      color: "text-blue-500",
      bg: "bg-blue-50",
      info: "Dihitung hadir (8 Jam/Hari)",
    },
    {
      id: "sakit",
      label: "Sakit",
      icon: Stethoscope,
      color: "text-red-500",
      bg: "bg-red-50",
      info: "Tidak dihitung jam kerja (0 Jam)",
    },
    {
      id: "cuti",
      label: "Cuti",
      icon: Plane,
      color: "text-purple-500",
      bg: "bg-purple-50",
      info: "Dihitung hadir (8 Jam/Hari)",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-24 font-sans">
      {/* HEADER */}
      <div className="bg-primary text-white pt-12 pb-8 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
        <h1 className="text-2xl font-black tracking-tight relative z-10">
          Layanan Pegawai
        </h1>
        <p className="text-sm text-indigo-100 mt-1 font-medium relative z-10">
          Formulir Ketidakhadiran & Cuti
        </p>
      </div>

      {/* TAB TOGGLE */}
      <div className="px-5 -mt-5 relative z-20">
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 flex gap-1">
          <button
            onClick={() => setActiveTab("form")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === "form"
                ? "bg-primary text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <FileText size={18} /> Buat Pengajuan
          </button>
          <button
            onClick={() => setActiveTab("riwayat")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              activeTab === "riwayat"
                ? "bg-primary text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <History size={18} /> Riwayat Saya
            {pendingSync > 0 && (
              <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping"></span>
            )}
          </button>
        </div>
      </div>

      {/* KONTEN */}
      <div className="p-5 mt-2">
        {activeTab === "form" ? (
          // ==================== TAB 1: FORMULIR ====================
          <form
            onSubmit={handleSubmit}
            className="space-y-5 animate-[fadeIn_0.3s_ease-out]"
          >
            {/* PILIHAN JENIS PENGAJUAN */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">
                Jenis Pengajuan
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {leaveTypes.map((item) => {
                  const Icon = item.icon;
                  const isSelected = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? `border-${item.color.split("-")[1]}-500 bg-${
                              item.color.split("-")[1]
                            }-50 ring-2 ring-${
                              item.color.split("-")[1]
                            }-200 ring-offset-1`
                          : "border-gray-200 hover:bg-gray-50 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon
                          size={16}
                          className={isSelected ? item.color : "text-gray-400"}
                        />
                        <span
                          className={`text-xs font-bold ${
                            isSelected ? "text-gray-800" : "text-gray-500"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                      <p
                        className={`text-[9px] font-semibold mt-1 leading-tight ${
                          isSelected ? item.color : "text-gray-400"
                        }`}
                      >
                        {item.info}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rentang Tanggal */}
            <div className="grid bg-white grid-cols-2 p-5 rounded-3xl shadow-sm border border-gray-100 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Mulai Tanggal
                </label>
                <div className="relative">
                  <Calendar
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-3 outline-none text-sm font-semibold text-gray-700"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Sampai Tanggal
                </label>
                <div className="relative">
                  <Calendar
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-3 outline-none text-sm font-semibold text-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* ALASAN & DOKUMEN */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                  Detail Alasan
                </label>
                <textarea
                  rows="3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan pengajuan Anda..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium text-gray-700 resize-none"
                  required
                ></textarea>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-1">
                  Bukti Dokumen / Foto <span className="text-red-500">*</span>
                </label>
                <div className="relative border-2 border-dashed border-gray-200 bg-gray-50 rounded-2xl p-4 text-center hover:bg-gray-100 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    required
                  />
                  {attachmentPreview ? (
                    <div className="space-y-2">
                      <img
                        src={attachmentPreview}
                        alt="Preview"
                        className="h-32 mx-auto rounded-lg object-contain"
                      />
                      <p className="text-xs font-bold text-primary">
                        Ketuk untuk mengganti foto
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
                        <ImageIcon size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">
                          Unggah Bukti
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Surat Dokter / Surat Tugas / Bukti Acara (Maks 2MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                isSubmitting
                  ? "bg-gray-400"
                  : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 active:scale-95"
              }`}
            >
              {isSubmitting ? (
                "Memproses..."
              ) : (
                <>
                  <Send size={20} /> Kirim Pengajuan
                </>
              )}
            </button>
          </form>
        ) : (
          // ==================== TAB 2: RIWAYAT ====================
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
            {pendingSync > 0 && (
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                <Info
                  size={20}
                  className="text-orange-500 flex-shrink-0 mt-0.5"
                />
                <div>
                  <h4 className="font-bold text-orange-700 text-sm">
                    Menunggu Sinkronisasi
                  </h4>
                  <p className="text-xs text-orange-600 mt-1 font-medium">
                    Ada {pendingSync} pengajuan yang tertunda karena jaringan
                    offline. Akan dikirim saat sinyal normal.
                  </p>
                </div>
              </div>
            )}

            {loadingHistory ? (
              <div className="text-center py-10">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm font-medium text-gray-400">
                  Memuat riwayat...
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
                <History size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-400">
                  Belum ada riwayat pengajuan
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                        Diajukan:{" "}
                        {format(new Date(item.created_at), "dd MMM yyyy", {
                          locale: localeId,
                        })}
                      </span>
                      <h4 className="font-black text-gray-800 text-base uppercase">
                        {item.type.replace("_", " ")}
                      </h4>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        item.status === "approved"
                          ? "bg-emerald-50 text-emerald-600"
                          : item.status === "rejected"
                          ? "bg-red-50 text-red-600"
                          : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {item.status === "approved" ? (
                        <CheckCircle size={12} />
                      ) : item.status === "rejected" ? (
                        <XCircle size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      {item.status === "pending"
                        ? "Diproses"
                        : item.status === "approved"
                        ? "Disetujui"
                        : "Ditolak"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 border border-gray-100">
                    <Calendar size={14} className="text-primary" />
                    {format(new Date(item.start_date), "dd MMM yy", {
                      locale: localeId,
                    })}
                    <span className="text-gray-400 font-normal">s/d</span>
                    {format(new Date(item.end_date), "dd MMM yy", {
                      locale: localeId,
                    })}
                  </div>

                  <p className="text-sm text-gray-600 font-medium">
                    "{item.reason}"
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ==================== MODAL SUKSES ==================== */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <CheckCircle size={40} />
            </div>

            <h2 className="text-xl font-black text-gray-800 mb-2">
              Pengajuan Berhasil!
            </h2>

            <p className="text-sm font-medium text-gray-500 leading-relaxed mb-8">
              Setelah Pengajuan ini dikirim, mohon segera infokan ke{" "}
              <strong>Wakasek Kurikulum</strong> untuk diproses persetujuannya.
            </p>

            <button
              onClick={handleCloseModal}
              className="w-full bg-primary hover:bg-primary_dark text-white font-bold py-4 rounded-2xl shadow-lg transition-colors"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
