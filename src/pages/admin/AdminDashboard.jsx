import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { adminService } from "../../services/adminService";
import { Users, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { getFormattedDate } from "../../utils/timeUtils";

export default function AdminDashboard() {
  const { user, schoolData } = useAuth();
  const [stats, setStats] = useState({
    totalGuru: 0,
    hadir: 0,
    belumHadir: 0,
    persentase: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (user?.school_id) {
        setLoading(true);
        const data = await adminService.getDashboardStats(user.school_id);
        setStats(data);
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const StatCard = ({ title, value, icon, colorClass, bgColor }) => (
    <div className="bg-white p-6 rounded-3xl shadow-lg shadow-gray-200/40 border border-gray-100 flex items-center gap-5">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bgColor} ${colorClass}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </p>
        <h3 className="text-3xl font-black text-gray-800 mt-1">
          {loading ? "..." : value}
        </h3>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Dashboard */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Ringkasan Hari Ini
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            {getFormattedDate()} • {schoolData?.name}
          </p>
        </div>
      </div>

      {/* Grid Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Pegawai"
          value={stats.totalGuru}
          icon={<Users size={28} />}
          colorClass="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="Hadir Hari Ini"
          value={stats.hadir}
          icon={<CheckCircle size={28} />}
          colorClass="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <StatCard
          title="Belum Hadir"
          value={stats.belumHadir}
          icon={<AlertCircle size={28} />}
          colorClass="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          title="Persentase"
          value={`${stats.persentase}%`}
          icon={<TrendingUp size={28} />}
          colorClass="text-primary"
          bgColor="bg-indigo-50"
        />
      </div>

      {/* Grafik / Progress (Placeholder Visual) */}
      <div className="bg-white p-8 rounded-3xl shadow-lg shadow-gray-200/40 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-6">
          Target Kehadiran Harian
        </h3>
        <div className="w-full bg-gray-100 h-6 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-1000"
            style={{ width: `${stats.persentase}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-3 text-sm font-bold text-gray-400">
          <span>0%</span>
          <span>{stats.persentase}% Tercapai</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
