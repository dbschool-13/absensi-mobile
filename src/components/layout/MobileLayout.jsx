import React, { useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Clock, User, Activity } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import GlobalLoader from "../ui/GlobalLoader";

export default function MobileLayout() {
  const location = useLocation();
  const { user, setGlobalLoading } = useAuth();

  useEffect(() => {
    setGlobalLoading(true);
    const timer = setTimeout(() => setGlobalLoading(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname, setGlobalLoading]);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#F4F6F9] relative overflow-hidden shadow-2xl sm:border-x sm:border-gray-200">
      <GlobalLoader />

      <div className="flex-1 overflow-y-auto pb-24 relative z-0">
        <Outlet />
      </div>

      <nav className="glass-nav absolute bottom-0 w-full flex justify-around items-center py-3 px-2 z-50 pb-6 rounded-t-3xl border border-white/50 bg-white/90 backdrop-blur-lg">
        <NavItem to="/dashboard" icon={<Home size={22} />} label="Utama" />
        <NavItem to="/riwayat" icon={<Clock size={22} />} label="Riwayat" />

        {/* Menu Khusus Kepala Sekolah */}
        {user?.role === "kepsek" && (
          <NavItem to="/pantau" icon={<Activity size={22} />} label="Pantau" />
        )}

        <NavItem to="/profil" icon={<User size={22} />} label="Profil" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center w-16 space-y-1 transition-all duration-300 ${
          isActive
            ? "text-primary scale-110 drop-shadow-md"
            : "text-gray-400 hover:text-gray-600"
        }`
      }
    >
      {icon}
      <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </NavLink>
  );
}
