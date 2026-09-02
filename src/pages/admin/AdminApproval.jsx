import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { leaveService } from "../../services/leaveService";
import toast from "react-hot-toast";
import {
  CheckCircle,
  XCircle,
  FileText,
  Image as ImageIcon,
  X,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function AdminApproval() {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // State untuk Modal Gambar
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchPendingRequests();
  }, [user]);

  const fetchPendingRequests = async () => {
    if (user?.school_id) {
      setLoading(true);
      const data = await leaveService.getPendingRequests(user.school_id);
      setPendingRequests(data);
      setLoading(false);
    }
  };

  const handleApprove = async (requestData) => {
    const isConfirm = window.confirm(
      `Setujui pengajuan ${requestData.type} untuk tanggal ${requestData.start_date}? (Sistem akan membuat absen otomatis)`,
    );
    if (!isConfirm) return;

    setIsProcessing(true);
    const toastId = toast.loading("Menyetujui & Menyuntikkan absen...");

    const success = await leaveService.approveLeaveRequest(requestData);

    if (success) {
      toast.success("Disetujui! Absen berhasil disuntikkan.", { id: toastId });
      fetchPendingRequests(); // Refresh tabel
    } else {
      toast.error("Gagal menyetujui pengajuan.", { id: toastId });
    }
    setIsProcessing(false);
  };

  const handleReject = async (requestId) => {
    const isConfirm = window.confirm("Yakin ingin menolak pengajuan ini?");
    if (!isConfirm) return;

    setIsProcessing(true);
    const toastId = toast.loading("Menolak pengajuan...");

    const success = await leaveService.rejectLeaveRequest(requestId);

    if (success) {
      toast.success("Pengajuan ditolak.", { id: toastId });
      fetchPendingRequests();
    } else {
      toast.error("Gagal menolak pengajuan.", { id: toastId });
    }
    setIsProcessing(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-24">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
          Verifikasi Izin & Cuti
        </h1>
        <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
          <FileText size={18} className="text-primary" /> Menunggu persetujuan
          Anda: <strong>{pendingRequests.length} Berkas</strong>
        </p>
      </div>

      {/* TABEL PENGAJUAN */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-5">Pegawai</th>
                <th className="p-5 text-center">Jenis</th>
                <th className="p-5 text-center">Tanggal</th>
                <th className="p-5">Alasan</th>
                <th className="p-5 text-center">Lampiran</th>
                <th className="p-5 text-center">Aksi</th>
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
              ) : pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    <CheckCircle
                      size={40}
                      className="mx-auto text-emerald-300 mb-3"
                    />
                    <p className="text-gray-500 font-bold">Semua Bersih!</p>
                    <p className="text-sm text-gray-400">
                      Tidak ada pengajuan izin yang mengantre.
                    </p>
                  </td>
                </tr>
              ) : (
                pendingRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-5">
                      <p className="font-bold text-gray-800">NIP: {req.nip}</p>
                      <p className="text-xs text-gray-400">
                        Tgl Pengajuan:{" "}
                        {format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </td>
                    <td className="p-5 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          req.type === "sakit"
                            ? "bg-red-50 text-red-500"
                            : req.type === "cuti"
                            ? "bg-purple-50 text-purple-500"
                            : "bg-blue-50 text-blue-500"
                        }`}
                      >
                        {req.type}
                      </span>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex flex-col items-center justify-center text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-xl">
                        <span>
                          {format(new Date(req.start_date), "dd MMM yy", {
                            locale: id,
                          })}
                        </span>
                        <span className="text-[10px] text-gray-400 leading-tight">
                          s/d
                        </span>
                        <span>
                          {format(new Date(req.end_date), "dd MMM yy", {
                            locale: id,
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="p-5">
                      <p className="text-sm font-semibold text-gray-700 line-clamp-2 max-w-xs">
                        {req.reason}
                      </p>
                    </td>
                    <td className="p-5 text-center">
                      {req.attachment ? (
                        <button
                          onClick={() => setSelectedImage(req.attachment)}
                          className="p-2 bg-indigo-50 text-indigo-500 rounded-xl hover:bg-indigo-100 transition-colors mx-auto flex flex-col items-center gap-1"
                        >
                          <ImageIcon size={20} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            Lihat
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-gray-400">
                          -
                        </span>
                      )}
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
                        >
                          <CheckCircle size={16} /> Setujui
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
                        >
                          <XCircle size={16} /> Tolak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL LIHAT SURAT */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-800">
                Lampiran Dokumen
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 bg-gray-50 flex justify-center">
              <img
                src={selectedImage}
                alt="Surat Dokter"
                className="max-h-[60vh] object-contain rounded-xl border border-gray-200 shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
