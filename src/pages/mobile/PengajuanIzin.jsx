import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { leaveService } from "../../services/leaveService";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import toast from "react-hot-toast";
import {
  Calendar,
  FileText,
  Camera as CameraIcon,
  CheckCircle,
  Clock,
  XCircle,
  Image as ImageIcon,
  WifiOff,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { getSecureTime } from "../../utils/secureTime";

export default function PengajuanIzin() {
  const { user, setGlobalLoading } = useAuth();

  // State UI
  const [activeTab, setActiveTab] = useState("formulir"); // 'formulir' atau 'riwayat'

  // State Form
  const [type, setType] = useState("sakit");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState(null); // Base64 image

  // State Data & Offline
  const [history, setHistory] = useState([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Riwayat & Pantau Sinyal
  useEffect(() => {
    fetchHistory();
    checkOfflineQueue();

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineLeaves(); // Otomatis kirim saat online
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  const fetchHistory = async () => {
    if (user) {
      const data = await leaveService.getUserLeaveHistory(user.nip);
      setHistory(data);
    }
  };

  const checkOfflineQueue = () => {
    const queue = JSON.parse(localStorage.getItem("offline_leaves") || "[]");
    setPendingSync(queue.length);
  };

  // 2. Mesin Sinkronisasi Offline
  const syncOfflineLeaves = async () => {
    const queue = JSON.parse(localStorage.getItem("offline_leaves") || "[]");
    if (queue.length === 0) return;

    setGlobalLoading(true);
    let successCount = 0;
    let newQueue = [...queue];

    for (let i = 0; i < queue.length; i++) {
      const data = queue[i];
      try {
        await leaveService.submitLeaveRequest(
          data.nip,
          data.school_id,
          data.type,
          data.start_date,
          data.end_date,
          data.reason,
          data.attachment,
        );
        newQueue = newQueue.filter((item) => item.id !== data.id);
        successCount++;
      } catch (error) {
        console.error("Gagal sinkron data izin:", data.id);
      }
    }

    localStorage.setItem("offline_leaves", JSON.stringify(newQueue));
    setPendingSync(newQueue.length);
    setGlobalLoading(false);

    if (successCount > 0) {
      toast.success(`${successCount} pengajuan offline berhasil dikirim!`);
      fetchHistory();
    }
  };

  // 3. Fungsi Ambil Foto Lampiran (Dokumen/Surat Dokter)
  const handleTakeAttachment = async () => {
    try {
      // Untuk dokumen, kita izinkan 'Prompt' agar user bisa pilih jepret langsung ATAU ambil dari galeri HP
      const photo = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        width: 800, // Resolusi agak besar agar tulisan surat bisa dibaca
      });

      if (photo && photo.webPath) {
        const imageURL = photo.webPath;
        const img = new Image();
        img.src = imageURL;

        await new Promise((resolve) => {
          img.onload = resolve;
        });

        // Kompresi Canvas
        const canvas = document.createElement("canvas");
        const targetWidth = 800;
        const scale = targetWidth / img.width;
        canvas.width = targetWidth;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const base64Photo = canvas.toDataURL("image/jpeg", 0.6);
        setAttachment(base64Photo);
      }
    } catch (error) {
      if (error.message !== "User cancelled photos app") {
        toast.error("Gagal mengambil foto dokumen.");
      }
    }
  };

  // 4. Fungsi Kirim Pengajuan
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      return toast.error("Harap lengkapi tanggal dan alasan!");
    }
    if (new Date(startDate) > new Date(endDate)) {
      return toast.error("Tanggal akhir tidak boleh mendahului tanggal mulai!");
    }
    if (type === "sakit" && !attachment) {
      return toast.error("Izin sakit wajib melampirkan foto Surat Dokter!");
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
      } else {
        // KIRIM ONLINE
        await leaveService.submitLeaveRequest(
          user.nip,
          user.school_id,
          type,
          startDate,
          endDate,
          reason,
          attachment,
        );
        toast.success("Pengajuan berhasil dikirim!");
        fetchHistory();
      }

      // Reset Form
      setType("sakit");
      setStartDate("");
      setEndDate("");
      setReason("");
      setAttachment(null);
      setActiveTab("riwayat"); // Pindah ke tab riwayat setelah berhasil
    } catch (error) {
      toast.error("Terjadi kesalahan saat mengirim pengajuan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Status Badge
  const StatusBadge = ({ status }) => {
    switch (status) {
      case "approved":
        return (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
            <CheckCircle size={12} /> Disetujui
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
            <XCircle size={12} /> Ditolak
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
            <Clock size={12} /> Menunggu
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-32 font-sans overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-500 via-primary to-violet-600 text-white pt-12 pb-16 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <h1 className="text-3xl font-black tracking-tight mb-2 relative z-10">
          Pengajuan Izin
        </h1>
        <p className="text-indigo-100 text-sm font-medium relative z-10">
          Formulir Ketidakhadiran Pegawai
        </p>

        {/* Offline Indicator */}
        {pendingSync > 0 && (
          <div className="absolute top-12 right-6 bg-orange-500 text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1.5 animate-pulse z-20">
            <WifiOff size={12} />
            {pendingSync} Tertunda
          </div>
        )}
      </div>

      <div className="-mt-8 mx-5 relative z-20 space-y-6">
        {/* Tab Navigation */}
        <div className="bg-white p-1.5 rounded-2xl shadow-lg flex gap-2 border border-gray-100">
          <button
            onClick={() => setActiveTab("formulir")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              activeTab === "formulir"
                ? "bg-primary text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Formulir Baru
          </button>
          <button
            onClick={() => setActiveTab("riwayat")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              activeTab === "riwayat"
                ? "bg-primary text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            Riwayat
          </button>
        </div>

        {/* TAB 1: FORMULIR */}
        {activeTab === "formulir" && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl shadow-lg p-6 border border-gray-100 space-y-5 animate-[slideUp_0.3s_ease-out]"
          >
            {/* Jenis Izin */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Jenis Pengajuan
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["sakit", "izin", "cuti"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                      type === t
                        ? "bg-indigo-50 border-indigo-200 text-primary"
                        : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Rentang Tanggal */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Alasan */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Alasan Lengkap
              </label>
              <div className="relative">
                <FileText
                  size={18}
                  className="absolute left-3 top-3 text-gray-400"
                />
                <textarea
                  required
                  rows="3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan pengajuan Anda..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-3 outline-none text-sm font-semibold text-gray-700 resize-none"
                />
              </div>
            </div>

            {/* Lampiran (Kamera) */}
            <div className="space-y-2">
              <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-500">
                <span>
                  Dokumen Pendukung{" "}
                  {type === "sakit" && (
                    <span className="text-red-500">*Wajib</span>
                  )}
                </span>
              </label>

              {!attachment ? (
                <button
                  type="button"
                  onClick={handleTakeAttachment}
                  className="w-full border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl py-6 flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <CameraIcon size={28} className="text-gray-400" />
                  <span className="text-sm font-bold">
                    Ambil Foto / Unggah Surat
                  </span>
                </button>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={attachment}
                    alt="Lampiran"
                    className="w-full h-32 object-cover opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm gap-4 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={handleTakeAttachment}
                      className="p-3 bg-white text-primary rounded-full shadow-lg"
                    >
                      <RefreshCw size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-3 bg-red-500 text-white rounded-full shadow-lg"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                    <ImageIcon size={12} /> Lampiran Tersimpan
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Kirim */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 mt-4 ${
                isSubmitting
                  ? "bg-gray-400 opacity-80"
                  : "bg-primary hover:bg-primary_dark shadow-primary/30"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{" "}
                  Memproses...
                </>
              ) : (
                "Kirim Pengajuan"
              )}
            </button>
          </form>
        )}

        {/* TAB 2: RIWAYAT */}
        {activeTab === "riwayat" && (
          <div className="space-y-4 animate-[slideUp_0.3s_ease-out]">
            {history.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl text-center shadow-sm border border-gray-100">
                <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-gray-500 font-bold">Belum ada riwayat</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Anda belum pernah mengajukan izin.
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${
                          item.type === "sakit"
                            ? "bg-red-50 text-red-500"
                            : item.type === "cuti"
                            ? "bg-purple-50 text-purple-500"
                            : "bg-blue-50 text-blue-500"
                        }`}
                      >
                        {item.type}
                      </span>
                      <h4 className="text-sm font-black text-gray-800 mt-2 line-clamp-1">
                        {item.reason}
                      </h4>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <Calendar size={14} className="text-primary" />
                    {format(new Date(item.start_date), "dd MMM yy", {
                      locale: id,
                    })}
                    <span className="text-gray-300">s/d</span>
                    {format(new Date(item.end_date), "dd MMM yy", {
                      locale: id,
                    })}
                  </div>

                  <p className="text-[10px] text-gray-400 font-medium mt-3 text-right">
                    Diajukan pada:{" "}
                    {format(new Date(item.created_at), "dd/MM/yy HH:mm")}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
