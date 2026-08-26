import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import {
  UserPlus,
  Search,
  Trash2,
  ShieldCheck,
  X,
  UploadCloud,
  DownloadCloud,
  Smartphone,
  Crown,
  User,
  Briefcase,
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

export default function AdminGuru() {
  const { user, schoolData } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState({
    nip: "",
    name: "",
    password: "",
    role: "guru",
  });

  const fileInputRef = useRef(null);

  const fetchTeachers = async () => {
    setLoading(true);
    if (user?.school_id)
      setTeachers(await adminService.getTeachers(user.school_id));
    setLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, [user]);

  const handleInputChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!formData.nip || !formData.name || !formData.password)
      return toast.error("Semua kolom wajib diisi!");

    setIsSubmitting(true);
    const newTeacherData = { ...formData, school_id: user.school_id };
    const result = await adminService.addTeacher(newTeacherData);

    if (result.success) {
      toast.success(result.message);
      setIsModalOpen(false);
      setFormData({ nip: "", name: "", password: "", role: "guru" });
      fetchTeachers();
    } else toast.error(result.message);
    setIsSubmitting(false);
  };

  const handleDelete = async (docId, name) => {
    if (window.confirm(`Yakin ingin menghapus data ${name}?`)) {
      if (await adminService.deleteTeacher(docId)) {
        toast.success("Data berhasil dihapus.");
        fetchTeachers();
      } else toast.error("Gagal menghapus data.");
    }
  };

  const handleResetDevice = async (docId, name) => {
    if (window.confirm(`Lepaskan tautan HP untuk ${name}?`)) {
      if (await adminService.resetDevice(docId)) {
        toast.success(`Tautan HP berhasil di-reset.`);
        fetchTeachers();
      } else toast.error("Gagal me-reset tautan perangkat.");
    }
  };

  // EXPORT TEMPLATE
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        NIP: "19800101",
        Nama: "Budi Santoso",
        Password: "password123",
        Role: "guru",
      },
      {
        NIP: "19700202",
        Nama: "Ahmad Dahlan",
        Password: "adminrahasia",
        Role: "kepsek",
      },
      {
        NIP: "19900303",
        Nama: "Siti Aminah",
        Password: "tendikaman",
        Role: "tendik",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Pegawai");
    XLSX.writeFile(wb, "Template_Import_Pegawai.xlsx");
  };

  // IMPORT EXCEL (Disempurnakan)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (data.length === 0) return toast.error("File Excel kosong!");

        let successCount = 0,
          failCount = 0;
        const toastId = toast.loading(
          `Mengimpor ${data.length} data... Mohon tunggu.`,
        );

        for (const row of data) {
          // Amankan nama kolom (Bisa membaca NIP atau nip, Nama atau nama)
          const nip = row.NIP || row.nip;
          const nama = row.Nama || row.nama;
          const password = row.Password || row.password;

          if (nip && nama && password) {
            // Amankan Role (Anti Typo)
            const roleInput = String(row.Role || row.role || "guru")
              .trim()
              .toLowerCase();
            let finalRole = "guru";
            if (roleInput.includes("kepsek") || roleInput.includes("kepala"))
              finalRole = "kepsek";
            else if (
              roleInput.includes("tendik") ||
              roleInput.includes("staf") ||
              roleInput.includes("tata usaha")
            )
              finalRole = "tendik";

            const newTeacherData = {
              nip: String(nip).trim(),
              name: String(nama).trim(),
              password: String(password).trim(),
              role: finalRole,
              school_id: user.school_id,
            };
            const result = await adminService.addTeacher(newTeacherData);
            if (result.success) successCount++;
            else failCount++;
          } else failCount++;
        }
        toast.dismiss(toastId);
        if (successCount > 0) {
          toast.success(`Berhasil impor ${successCount} data!`);
          fetchTeachers();
        }
        if (failCount > 0)
          toast.error(
            `${failCount} data gagal diimpor (NIP Duplikat/Format Salah).`,
          );
      } catch (error) {
        toast.error("Gagal membaca file Excel.");
      } finally {
        setIsImporting(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.nip.includes(searchTerm),
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Data Pegawai
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            Kelola akses akun Kepsek, Guru, dan Tendik {schoolData?.name}.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={isImporting}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {isImporting ? (
              <span className="animate-pulse">Mengimpor...</span>
            ) : (
              <>
                <UploadCloud size={18} /> Import Excel
              </>
            )}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-white hover:bg-primary_dark px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/30"
          >
            <UserPlus size={18} /> Tambah Manual
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama atau NIP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm"
          />
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-sm text-gray-500 font-bold hover:text-primary transition-colors px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 hover:bg-white"
        >
          <DownloadCloud size={16} /> Download Template Excel
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/40 border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-5 w-16 text-center">No</th>
                <th className="p-5">Nama Pegawai</th>
                <th className="p-5">NIP & Password</th>
                <th className="p-5 text-center">Role / Jabatan</th>
                <th className="p-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    className="p-8 text-center text-gray-400 font-medium animate-pulse"
                  >
                    Memuat data...
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="p-8 text-center text-gray-400 font-medium"
                  >
                    Tidak ada data ditemukan.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((guru, idx) => (
                  <tr
                    key={guru.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-5 text-center font-semibold text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="p-5 font-bold text-gray-800">{guru.name}</td>
                    <td className="p-5">
                      <p className="text-gray-600 font-medium">{guru.nip}</p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        Pass: {guru.password}
                      </p>
                    </td>
                    <td className="p-5 text-center">
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto ${
                          guru.role === "kepsek"
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : guru.role === "tendik"
                              ? "bg-purple-50 text-purple-600 border border-purple-200"
                              : "bg-blue-50 text-blue-600 border border-blue-200"
                        }`}
                      >
                        {guru.role === "kepsek" ? (
                          <>
                            <Crown size={14} /> Kepsek
                          </>
                        ) : guru.role === "tendik" ? (
                          <>
                            <Briefcase size={14} /> Tendik
                          </>
                        ) : (
                          <>
                            <User size={14} /> Guru
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-5 text-center flex justify-center gap-2">
                      <button
                        onClick={() => handleResetDevice(guru.id, guru.name)}
                        className={`p-2 rounded-lg transition-colors flex items-center justify-center ${guru.device_id ? "bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white" : "bg-gray-50 text-gray-300 cursor-not-allowed"}`}
                        title={guru.device_id ? "Reset HP" : "Belum tertaut HP"}
                        disabled={!guru.device_id}
                      >
                        <Smartphone size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(guru.id, guru.name)}
                        className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                        title="Hapus Akun"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-[flyIn_0.3s_ease-out]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">
                Tambah Pegawai Manual
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddTeacher} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Role / Jabatan
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                >
                  <option value="guru">Guru</option>
                  <option value="tendik">Tenaga Kependidikan (Tendik)</option>
                  <option value="kepsek">Kepala Sekolah</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  NIP / NIK
                </label>
                <input
                  type="text"
                  name="nip"
                  value={formData.nip}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Password / PIN
                </label>
                <input
                  type="text"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white bg-primary hover:bg-primary_dark transition-colors flex justify-center items-center"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
