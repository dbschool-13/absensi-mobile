import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  LogOut,
  School,
  Settings,
  Activity,
} from "lucide-react";
import GlobalLoader from "../ui/GlobalLoader";

export default function AdminLayout() {
  const { user, schoolData, logout, setGlobalLoading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItemClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
      isActive
        ? "bg-primary text-white shadow-lg shadow-primary/30"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    }`;

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <GlobalLoader />

      {/* SIDEBAR (Desktop) */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-xl z-20">
        {/* Logo Sekolah */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-gray-50">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center p-1">
            {schoolData?.logo_url ? (
              <img
                src={schoolData.logo_url}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <School className="text-primary" size={20} />
            )}
          </div>
          <div>
            <h1 className="font-bold text-gray-800 text-sm line-clamp-1">
              {schoolData?.name || "Admin Panel"}
            </h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">
              Portal Sekolah
            </p>
          </div>
        </div>

        {/* Menu Navigasi */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavLink to="/admin/dashboard" className={navItemClass}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/admin/pantau" className={navItemClass}>
            <Activity size={20} /> Monitoring{" "}
          </NavLink>
          <NavLink to="/admin/rekap" className={navItemClass}>
            <FileSpreadsheet size={20} /> Rekap & Export
          </NavLink>
          <NavLink to="/admin/setting" className={navItemClass}>
            <Settings size={20} /> Pengaturan
          </NavLink>
          <NavLink to="/admin/guru" className={navItemClass}>
            <Users size={20} /> Data Guru
          </NavLink>
          <NavLink to="/admin/verifikasi-izin" className={navItemClass}>
            <Users size={20} /> Approve Pengajuan
          </NavLink>
        </nav>

        {/* Profil & Logout Admin */}
        <div className="p-4 border-t border-gray-50">
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
            <p className="text-xs text-gray-400 font-semibold mb-1">
              Login sebagai Admin:
            </p>
            <p className="text-sm font-bold text-gray-800 line-clamp-1">
              {user?.name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-xl font-bold transition-colors"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 overflow-y-auto relative bg-[#F8F9FA]">
        <Outlet />
      </main>
    </div>
  );
}
