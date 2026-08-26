import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGeolocation } from "../../hooks/useGeolocation";
import { calculateDistance } from "../../utils/distanceCalculator";
import { attendanceService } from "../../services/attendanceService";
import RadiusMap from "../../components/map/RadiusMap";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  User as UserIcon,
  LogIn,
  LogOut,
  Navigation,
  School,
  CalendarX,
  CalendarCheck,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { id } from "date-fns/locale";

export default function Dashboard() {
  const { user, schoolData, setGlobalLoading } = useAuth();
  const {
    latitude,
    longitude,
    error,
    loading: gpsLoading,
    refreshLocation,
  } = useGeolocation();

  const [distance, setDistance] = useState(null);
  const [isInRadius, setIsInRadius] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayAtt, setTodayAtt] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchTodayAtt = async () => {
      if (user) {
        const attData = await attendanceService.getTodayAttendance(user.nip);
        setTodayAtt(attData);
      }
    };
    fetchTodayAtt();
  }, [user]);

  useEffect(() => {
    if (latitude && longitude && schoolData) {
      const dist = calculateDistance(
        latitude,
        longitude,
        schoolData.latitude,
        schoolData.longitude,
      );
      setDistance(dist);
      setIsInRadius(dist <= schoolData.radius_meters);
    }
  }, [latitude, longitude, schoolData]);

  const openModal = (type) => {
    setModalType(type);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setModalType(null);
  };

  const handleSaveAttendance = async () => {
    closeModal();
    setGlobalLoading(true);

    if (modalType === "datang") {
      const result = await attendanceService.checkIn(
        user.nip,
        user.school_id,
        latitude,
        longitude,
        distance,
      );
      if (result) setTodayAtt({ ...todayAtt, ...result });
    } else if (modalType === "pulang") {
      const result = await attendanceService.checkOut(
        user.nip,
        latitude,
        longitude,
        distance,
        todayAtt.check_in.time,
      );
      if (result) setTodayAtt((prev) => ({ ...prev, ...result }));
    }

    setGlobalLoading(false);
  };

  const hasCheckedIn = !!todayAtt?.check_in;
  const hasCheckedOut = !!todayAtt?.check_out;

  // Logika Hari Kerja
  const todayStr = format(currentTime, "yyyy-MM-dd");
  const todayDayOfWeek = currentTime.getDay();
  const workingDaysDef = schoolData?.working_days || [1, 2, 3, 4, 5];
  const holidaysDef = schoolData?.holidays || [];
  const holidayData = holidaysDef.find((h) => h.date === todayStr);
  const isHoliday = !!holidayData;
  const isWorkingDay = workingDaysDef.includes(todayDayOfWeek) && !isHoliday;

  // Logika Waktu
  const currentHM = format(currentTime, "HH:mm");
  const timeRules = schoolData?.time_rules || {
    check_in_start: "06:00",
    check_in_end: "07:30",
    check_out_start: "15:00",
    check_out_end: "18:00",
  };
  const isCheckInTimeValid =
    currentHM >= timeRules.check_in_start &&
    currentHM <= timeRules.check_in_end;
  const isCheckOutTimeValid =
    currentHM >= timeRules.check_out_start &&
    currentHM <= timeRules.check_out_end;

  // Kalkulasi Target 8 Jam
  const targetMinutes = 8 * 60;
  let workedMinutes = 0;

  if (hasCheckedIn) {
    const checkInDate = todayAtt.check_in.time?.toDate
      ? todayAtt.check_in.time.toDate()
      : new Date(todayAtt.check_in.time);
    if (hasCheckedOut) {
      const checkOutDate = todayAtt.check_out.time?.toDate
        ? todayAtt.check_out.time.toDate()
        : new Date(todayAtt.check_out.time);
      workedMinutes = differenceInMinutes(checkOutDate, checkInDate);
    } else {
      workedMinutes = differenceInMinutes(currentTime, checkInDate);
    }
  }

  const progressPercent = Math.min(
    Math.max((workedMinutes / targetMinutes) * 100, 0),
    100,
  );
  const hoursWorked = Math.floor(Math.max(workedMinutes, 0) / 60);
  const minsWorked = Math.max(workedMinutes, 0) % 60;

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  // Setup SVG Circular Progress
  const circleRadius = 38;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset =
    circleCircumference - (progressPercent / 100) * circleCircumference;

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-32 font-sans overflow-x-hidden">
      {/* ========================================== */}
      {/* 1. HEADER (Animated Gradient)              */}
      {/* ========================================== */}
      <div className="bg-gradient-to-br from-indigo-500 via-primary to-violet-600 animate-gradient-bg text-white pt-12 pb-24 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        {/* Abstract Ornaments */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-10 left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>

        {/* Top Navbar */}
        <div className="flex justify-between items-center relative z-10 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <UserIcon size={22} className="text-white drop-shadow-md" />
            </div>
            <div>
              <p className="text-xs text-indigo-100 font-semibold tracking-wide opacity-90">
                {getGreeting()},
              </p>
              <h2 className="text-base font-bold text-white tracking-wide">
                {user?.name || "Guru"}
              </h2>
            </div>
          </div>

          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center p-1.5 shadow-lg border border-white/20">
            {schoolData?.logo_url ? (
              <img
                src={schoolData.logo_url}
                alt="Logo"
                className="w-full h-full object-contain rounded-full"
              />
            ) : (
              <School size={20} className="text-white" />
            )}
          </div>
        </div>

        {/* Big Clock Area */}
        <div className="relative z-10 text-center flex flex-col items-center">
          <h1 className="text-4xl font-black tracking-tighter drop-shadow-lg flex items-baseline justify-center">
            {format(currentTime, "HH:mm")}
            <span className="text-xl font-bold opacity-70 ml-1">
              :{format(currentTime, "ss")}
            </span>
          </h1>
          <p className="text-sm text-indigo-100 mt-2 font-semibold tracking-wide bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            {format(currentTime, "EEEE, dd MMMM yyyy", { locale: id })}
          </p>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. MAIN CARDS (Staggered Animations)       */}
      {/* ========================================== */}
      <div className="-mt-14 mx-5 space-y-5 relative z-20">
        {/* A. Status Lokasi & Badge Hari (Hero Card) */}
        <div
          className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-xl shadow-indigo-900/10 p-1 border border-white animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="bg-white rounded-[1.3rem] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${
                  isInRadius
                    ? "bg-emerald-50 text-emerald-500"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {/* Ping Animation on Map Icon */}
                {isInRadius && (
                  <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
                )}
                {gpsLoading ? (
                  <Navigation size={22} className="animate-spin" />
                ) : isInRadius ? (
                  <MapPin size={22} />
                ) : (
                  <AlertCircle size={22} />
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
                  Status Lokasi
                </h3>
                <h3 className="text-sm font-black text-gray-800 line-clamp-1">
                  {gpsLoading
                    ? "Mencari GPS..."
                    : isInRadius
                    ? "Dalam Area Sekolah"
                    : "Di Luar Area"}
                </h3>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  isInRadius
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {distance !== null ? `${distance} m` : "..."}
              </div>
              <button
                onClick={refreshLocation}
                disabled={gpsLoading}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={gpsLoading ? "animate-spin" : ""}
                />{" "}
                Segarkan
              </button>
            </div>
          </div>

          {/* Badge Hari Kerja / Libur (Terintegrasi rapi di bawah lokasi) */}
          <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-b-[1.3rem]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Jadwal Hari Ini
            </span>
            {isWorkingDay ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <CalendarCheck size={14} /> Hari Kerja
              </span>
            ) : (
              <span className="text-xs font-bold text-red-500 flex items-center gap-1.5 line-clamp-1">
                <CalendarX size={14} /> Libur:{" "}
                {holidayData?.description || "Akhir Pekan"}
              </span>
            )}
          </div>
        </div>

        {/* B. Progress Cincin (Circular Progress) */}
        <div
          className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100 flex items-center gap-6 animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          {/* Custom Circular SVG */}
          <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 100 100"
            >
              {/* Background Circle */}
              <circle
                cx="50"
                cy="50"
                r={circleRadius}
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                className="text-gray-100"
              />
              {/* Progress Circle */}
              <circle
                cx="50"
                cy="50"
                r={circleRadius}
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-emerald-500 transition-all duration-1000 ease-out drop-shadow-md"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black text-gray-800">
                {Math.round(progressPercent)}%
              </span>
            </div>
          </div>

          {/* Progress Details */}
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
              Target 8 Jam
            </p>
            <h3 className="text-2xl font-black text-gray-800 mb-1">
              {hoursWorked}j{" "}
              <span className="text-base text-gray-500">{minsWorked}m</span>
            </h3>
            <p className="text-xs font-medium text-gray-400">
              {hasCheckedOut
                ? progressPercent >= 100
                  ? "✅ Target Terpenuhi"
                  : "⚠️ Kurang dari 8 Jam"
                : hasCheckedIn
                ? "Durasi berjalan..."
                : "Belum absen masuk"}
            </p>
          </div>
        </div>

        {/* C. Grid Jam Masuk & Keluar */}
        <div
          className="grid grid-cols-2 gap-4 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 bg-emerald-50 w-24 h-24 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center gap-2 text-gray-400 mb-2 relative z-10">
              <div className="p-1.5 bg-gray-50 rounded-lg">
                <LogIn size={14} className="text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Absen Masuk
              </span>
            </div>
            <p className="text-3xl font-black text-gray-800 relative z-10">
              {hasCheckedIn
                ? format(
                    todayAtt.check_in.time?.toDate
                      ? todayAtt.check_in.time.toDate()
                      : new Date(todayAtt.check_in.time),
                    "HH:mm",
                  )
                : "--:--"}
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 bg-red-50 w-24 h-24 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="flex items-center gap-2 text-gray-400 mb-2 relative z-10">
              <div className="p-1.5 bg-gray-50 rounded-lg">
                <LogOut size={14} className="text-red-500" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Absen Keluar
              </span>
            </div>
            <p className="text-3xl font-black text-gray-800 relative z-10">
              {hasCheckedOut
                ? format(
                    todayAtt.check_out.time?.toDate
                      ? todayAtt.check_out.time.toDate()
                      : new Date(todayAtt.check_out.time),
                    "HH:mm",
                  )
                : "--:--"}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 3. FLOATING DOCK ACTION BUTTONS            */}
      {/* ========================================== */}
      <div
        className="fixed bottom-24 left-0 w-full px-5 z-40 animate-fade-in-up"
        style={{ animationDelay: "0.4s" }}
      >
        <div className="bg-white/70 backdrop-blur-2xl p-2.5 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-white flex gap-3">
          <button
            onClick={() => openModal("datang")}
            disabled={
              !isInRadius ||
              gpsLoading ||
              hasCheckedIn ||
              !isCheckInTimeValid ||
              !isWorkingDay
            }
            className={`flex-1 py-4 rounded-[1.5rem] transition-all active:scale-95 flex flex-col items-center justify-center gap-1 relative overflow-hidden ${
              hasCheckedIn ||
              (!isCheckInTimeValid && !hasCheckedIn) ||
              !isInRadius ||
              !isWorkingDay
                ? "bg-gray-100 text-gray-400 opacity-90"
                : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 btn-active-pulse"
            }`}
          >
            <span className="font-bold text-sm tracking-wide">
              {!isWorkingDay
                ? "Libur"
                : hasCheckedIn
                ? "Sudah Absen"
                : "Absen Datang"}
            </span>
            {!hasCheckedIn && isWorkingDay && (
              <span
                className={`text-[9px] uppercase font-bold tracking-widest ${
                  isCheckInTimeValid ? "text-emerald-100" : "text-red-400"
                }`}
              >
                {isCheckInTimeValid
                  ? `${timeRules.check_in_start} - ${timeRules.check_in_end}`
                  : "Luar Jam"}
              </span>
            )}
          </button>

          <button
            onClick={() => openModal("pulang")}
            disabled={
              !isInRadius ||
              !hasCheckedIn ||
              hasCheckedOut ||
              !isCheckOutTimeValid ||
              !isWorkingDay
            }
            className={`flex-1 py-4 rounded-[1.5rem] transition-all active:scale-95 flex flex-col items-center justify-center gap-1 relative overflow-hidden ${
              !hasCheckedIn ||
              hasCheckedOut ||
              (!isCheckOutTimeValid && hasCheckedIn && !hasCheckedOut) ||
              !isInRadius ||
              !isWorkingDay
                ? "bg-gray-100 text-gray-400 opacity-90"
                : "bg-red-500 text-white shadow-lg shadow-red-500/40 btn-active-pulse"
            }`}
          >
            <span className="font-bold text-sm tracking-wide">
              {!isWorkingDay
                ? "Libur"
                : hasCheckedOut
                ? "Sudah Absen"
                : "Absen Pulang"}
            </span>
            {hasCheckedIn && !hasCheckedOut && isWorkingDay && (
              <span
                className={`text-[9px] uppercase font-bold tracking-widest ${
                  isCheckOutTimeValid ? "text-red-100" : "text-red-400"
                }`}
              >
                {isCheckOutTimeValid
                  ? `${timeRules.check_out_start} - ${timeRules.check_out_end}`
                  : "Luar Jam"}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 4. MODAL BOTTOM SHEET                      */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-0" onClick={closeModal}></div>
          <div className="bg-white rounded-t-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_0.3s_ease-out] relative z-10 pb-24 pt-3">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto my-2"></div>

            <div className="px-6 py-4 flex justify-between items-center mb-2 border-b border-gray-50">
              <div>
                <h3 className="text-lg font-black text-gray-800 tracking-tight">
                  Konfirmasi {modalType === "datang" ? "Masuk" : "Keluar"}
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">
                  Pastikan lokasi Anda sudah akurat.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 space-y-4 mt-4">
              <div className="h-[200px] w-full rounded-[2rem] overflow-hidden shadow-inner border border-gray-100 relative">
                <RadiusMap
                  userLat={latitude}
                  userLon={longitude}
                  schoolLat={schoolData?.latitude}
                  schoolLon={schoolData?.longitude}
                  radius={schoolData?.radius_meters || 50}
                />
              </div>
              <div
                className={`p-4 rounded-[1.5rem] flex items-center justify-center gap-3 border ${
                  isInRadius
                    ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                    : "bg-red-50 border-red-100 text-red-600"
                }`}
              >
                {isInRadius ? (
                  <CheckCircle size={22} />
                ) : (
                  <AlertCircle size={22} />
                )}
                <span className="font-bold text-sm uppercase tracking-wide">
                  {isInRadius
                    ? `Lokasi Valid (${distance}m)`
                    : `Di Luar Area (${distance}m)`}
                </span>
              </div>
            </div>

            <div className="px-6 mt-6 flex gap-4">
              <button
                onClick={closeModal}
                className="w-1/3 py-4 rounded-[1.5rem] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={!isInRadius}
                className={`flex-1 py-4 rounded-[1.5rem] font-bold text-white shadow-xl transition-transform active:scale-95 flex justify-center items-center ${
                  modalType === "datang"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-emerald-500/40"
                    : "bg-gradient-to-r from-red-500 to-red-400 shadow-red-500/40"
                }`}
              >
                {modalType === "datang"
                  ? "Kirim Absen Masuk"
                  : "Kirim Absen Keluar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
