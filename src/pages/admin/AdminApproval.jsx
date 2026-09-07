import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { leaveService } from "../../services/leaveService";
import { adminService } from "../../services/adminService";
import { db } from "../../services/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";
import {
  CheckCircle,
  XCircle,
  FileText,
  Image as ImageIcon,
  X,
  History,
  Clock,
  ZoomIn,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default function AdminApproval() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");

  const [pendingRequests, setPendingRequests] = useState([]);
  const [resolvedRequests, setResolvedRequests] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (!user?.school_id) return;

    setLoading(true);

    adminService.getTeachers(user.school_id).then((teachersData) => {
      setTeachers(teachersData);
    });

    const q = query(
      collection(db, "leave_requests"),
      where("school_id", "==", user.school_id),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending = [];
      const resolved = [];

      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (data.status === "pending") {
          pending.push(data);
        } else if (data.status === "approved" || data.status === "rejected") {
          resolved.push(data);
        }
      });

      pending.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      resolved.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setPendingRequests(pending);
      setResolvedRequests(resolved);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleApprove = async (requestData) => {
    const isConfirm = window.confirm(
      `Setujui pengajuan ${requestData.type.replace("_", " ")} untuk tanggal ${
        requestData.start_date
      }? (Sistem akan membuat absen otomatis)`,
    );
    if (!isConfirm) return;

    setIsProcessing(true);
    const toastId = toast.loading("Menyetujui & Menyuntikkan absen...");

    const success = await leaveService.approveLeaveRequest(requestData);

    if (success) {
      toast.success("Disetujui! Absen berhasil disuntikkan.", { id: toastId });
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
    } else {
      toast.error("Gagal menolak pengajuan.", { id: toastId });
    }
    setIsProcessing(false);
  };

  const getTeacherName = (nip) => {
    const teacher = teachers.find((t) => t.nip === nip);
    return teacher ? teacher.name : "Data tidak ditemukan";
  };

  const currentData =
    activeTab === "pending" ? pendingRequests : resolvedRequests;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-24 font-sans">
      {/* HEADER & TAB NAVIGATION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Manajemen Izin & Cuti
          </h1>
          <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
            Kelola persetujuan ketidakhadiran pegawai secara *Real-Time*
          </p>
        </div>

        {/* TAB BUTTONS */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 flex gap-1 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "pending"
                ? "bg-primary text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Clock size={16} /> Menunggu
            {pendingRequests.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-primary text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <History size={16} /> Riwayat
          </button>
        </div>
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
                <th className="p-5 text-center">Status / Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="p-12 text-center text-gray-400 font-medium"
                  >
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    Menghubungkan ke Server Live...
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center">
                    {activeTab === "pending" ? (
                      <>
                        <CheckCircle
                          size={40}
                          className="mx-auto text-emerald-300 mb-3"
                        />
                        <p className="text-gray-500 font-bold">Semua Bersih!</p>
                        <p className="text-sm text-gray-400">
                          Tidak ada pengajuan izin yang mengantre.
                        </p>
                      </>
                    ) : (
                      <>
                        <History
                          size={40}
                          className="mx-auto text-gray-300 mb-3"
                        />
                        <p className="text-gray-500 font-bold">
                          Belum Ada Riwayat
                        </p>
                        <p className="text-sm text-gray-400">
                          Riwayat persetujuan atau penolakan akan muncul di
                          sini.
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                currentData.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-5">
                      <p className="font-bold text-gray-800">
                        {req.name || req.nama || getTeacherName(req.nip)}
                      </p>
                      <p className="text-xs font-semibold text-gray-500 mt-0.5">
                        NIP: {req.nip}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Diajukan:{" "}
                        {format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </td>
                    <td className="p-5 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          req.type === "sakit"
                            ? "bg-orange-50 text-orange-600 border-orange-200"
                            : req.type === "cuti"
                            ? "bg-purple-50 text-purple-600 border-purple-200"
                            : "bg-blue-50 text-blue-600 border-blue-200"
                        }`}
                      >
                        {req.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex flex-col items-center justify-center text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200">
                        <span>
                          {format(new Date(req.start_date), "dd MMM yy", {
                            locale: id,
                          })}
                        </span>
                        <span className="text-[9px] text-gray-400 leading-tight my-0.5">
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
                      <p className="text-sm font-semibold text-gray-700 line-clamp-3 max-w-xs">
                        {req.reason}
                      </p>
                    </td>
                    <td className="p-5 text-center">
                      {req.attachment ? (
                        <button
                          onClick={() => setSelectedImage(req.attachment)}
                          className="p-2 bg-indigo-50 text-indigo-500 rounded-xl hover:bg-indigo-100 transition-colors mx-auto flex flex-col items-center gap-1 border border-indigo-100"
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
                      {activeTab === "pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1 active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle size={14} /> Setujui
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1 active:scale-95 disabled:opacity-50"
                          >
                            <XCircle size={14} /> Tolak
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1">
                          {req.status === "approved" ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                              <CheckCircle size={14} /> Disetujui
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
                              <XCircle size={14} /> Ditolak
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL LIHAT SURAT (Diperbesar Ekstra)      */}
      {/* ========================================== */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] max-h-[95vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-2 text-gray-800">
                <ZoomIn size={22} className="text-primary" />
                <h3 className="text-lg font-black tracking-tight">
                  Pratinjau Lampiran
                </h3>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                title="Tutup (Esc)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Container Gambar (Bisa Scroll jika terlalu panjang) */}
            <div className="p-4 md:p-8 bg-gray-100 flex-1 flex justify-center items-center overflow-auto">
              <img
                src={selectedImage}
                alt="Bukti Lampiran"
                className="max-h-[80vh] w-auto object-contain rounded-xl shadow-lg border border-gray-200/50 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
