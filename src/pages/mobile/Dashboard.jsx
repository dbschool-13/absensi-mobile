import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGeolocation } from "../../hooks/useGeolocation";
import { calculateDistance } from "../../utils/distanceCalculator";
import { attendanceService } from "../../services/attendanceService";
import RadiusMap from "../../components/map/RadiusMap";
import toast from "react-hot-toast";
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

  const [isCameraMode, setIsCameraMode] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

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

  // 1. Fungsi buka modal
  const openModal = (type) => {
    setModalType(type);
    setIsCameraMode(false);
    setIsModalOpen(true);
    setIsMapReady(false); // Matikan peta dulu

    // Tahan peta selama 400ms (menunggu animasi pop-up selesai) baru render
    setTimeout(() => {
      setIsMapReady(true);
    }, 400);
  };

  // 2. Fungsi tutup modal
  const closeModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    setIsCameraMode(false);
    setIsMapReady(false); // Reset peta
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // 3. Fungsi mengubah modal menjadi Layar Kamera
  const startCamera = async () => {
    setIsCameraMode(true);
    try {
      // PERBAIKAN 1: Hapus batasan width agar iPhone bebas menggunakan resolusi aslinya
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);

      // PERBAIKAN 2: Beri jeda sedikit lebih lama, lalu paksa Play!
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          // Paksaan Play wajib untuk sistem iOS
          videoRef.current
            .play()
            .catch((err) => console.log("iOS Play Error:", err));
        }
      }, 300);
    } catch (error) {
      toast.error("Izin kamera ditolak atau diblokir oleh Safari/iPhone!");
      setIsCameraMode(false);
    }
  };

  // 4. Fungsi memotret dan menyimpan
  // 4. Fungsi memotret dan menyimpan
  const handleSaveAttendance = async () => {
    try {
      // PERBAIKAN 3: Cegah klik simpan jika kamera iPhone masih nge-blank (Video width = 0)
      if (!videoRef.current || !stream || videoRef.current.videoWidth === 0) {
        return toast.error("Kamera sedang dimuat, mohon tunggu sebentar.");
      }

      // Jepret dan Kompresi Cerdas (Menyesuaikan rasio asli HP)
      const canvas = document.createElement("canvas");
      const targetWidth = 500; // Target akhir tetap 500px agar ringan di database
      const scale = targetWidth / videoRef.current.videoWidth;

      canvas.width = targetWidth;
      canvas.height = videoRef.current.videoHeight * scale;

      const ctx = canvas.getContext("2d");
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1); // Efek Cermin
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const base64PhotoURL = canvas.toDataURL("image/jpeg", 0.5);

      // ... KODE BAWAHNYA TETAP SAMA SEPERTI SEBELUMNYA ...
      closeModal();
      setGlobalLoading(true);

      if (modalType === "datang") {
        const result = await attendanceService.checkIn(
          user.nip,
          user.school_id,
          latitude,
          longitude,
          distance,
          base64PhotoURL,
        );
        if (result) setTodayAtt({ ...todayAtt, ...result });
      } else if (modalType === "pulang") {
        const result = await attendanceService.checkOut(
          user.nip,
          latitude,
          longitude,
          distance,
          todayAtt.check_in.time,
          base64PhotoURL,
        );
        if (result) setTodayAtt((prev) => ({ ...prev, ...result }));
      }

      setGlobalLoading(false);
    } catch (error) {
      toast.error("Terjadi kesalahan saat memproses foto.");
      setGlobalLoading(false);
    }
  };

  const hasCheckedIn = !!todayAtt?.check_in;
  const hasCheckedOut = !!todayAtt?.check_out;

  const todayStr = format(currentTime, "yyyy-MM-dd");
  const todayDayOfWeek = currentTime.getDay();
  const workingDaysDef = schoolData?.working_days || [1, 2, 3, 4, 5];
  const holidaysDef = schoolData?.holidays || [];
  const holidayData = holidaysDef.find((h) => h.date === todayStr);
  const isHoliday = !!holidayData;
  const isWorkingDay = workingDaysDef.includes(todayDayOfWeek) && !isHoliday;

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

  const circleRadius = 38;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset =
    circleCircumference - (progressPercent / 100) * circleCircumference;

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-32 font-sans overflow-x-hidden">
      <div className="bg-gradient-to-br from-indigo-500 via-primary to-violet-600 animate-gradient-bg text-white pt-12 pb-24 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-10 left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>

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

      <div className="-mt-14 mx-5 space-y-5 relative z-20">
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

        <div
          className="bg-white rounded-3xl shadow-lg shadow-gray-200/50 p-5 border border-gray-100 flex items-center gap-6 animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r={circleRadius}
                stroke="currentColor"
                strokeWidth="10"
                fill="transparent"
                className="text-gray-100"
              />
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
                Absen Pulang
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

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-0" onClick={closeModal}></div>
          <div className="bg-white rounded-t-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_0.3s_ease-out] relative z-10 pb-24 pt-3">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto my-2"></div>

            <div className="px-6 py-4 flex justify-between items-center mb-2 border-b border-gray-50">
              <div>
                <h3 className="text-lg font-black text-gray-800 tracking-tight">
                  Konfirmasi {modalType === "datang" ? "Masuk" : "Pulang"}
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
              {!isCameraMode ? (
                <>
                  {/* BUNGKUSAN PETA YANG DIPERKETAT */}
                  <div className="h-[200px] w-full bg-slate-100 rounded-[2rem] overflow-hidden relative border-4 border-white mb-4 shadow-inner">
                    {latitude &&
                    longitude &&
                    schoolData?.latitude &&
                    schoolData?.longitude &&
                    isMapReady ? (
                      // Inline style absolute memaksa Leaflet menghitung ukuran 100% dari parent
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                        }}
                      >
                        <RadiusMap
                          key={`map-${latitude}-${longitude}-${isModalOpen}`}
                          userLat={latitude}
                          userLng={longitude}
                          schoolLat={schoolData.latitude}
                          schoolLng={schoolData.longitude}
                          radius={schoolData.radius_meters}
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-slate-50 z-10">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-gray-400 text-[10px] font-bold animate-pulse">
                          {!isMapReady
                            ? "Menyesuaikan Peta..."
                            : "Mencari GPS..."}
                        </span>
                      </div>
                    )}
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
                </>
              ) : (
                <>
                  <div className="h-[280px] w-full bg-slate-900 rounded-[2rem] overflow-hidden shadow-inner relative border-4 border-gray-100">
                    {stream ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        webkit-playsinline="true"
                        muted
                        className="w-full h-full object-cover transform scale-x-[-1]"
                      ></video>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-gray-400 text-xs font-bold animate-pulse">
                          Menyiapkan Kamera...
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 border-2 border-dashed border-white/40 rounded-[2rem] pointer-events-none m-6 opacity-70"></div>

                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-[9px] font-bold text-white uppercase tracking-widest">
                        Live
                      </span>
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-500 font-bold animate-pulse">
                    Posisikan wajah Anda pada bingkai
                  </p>
                </>
              )}
            </div>

            <div className="p-6 pt-2 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-3.5 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>

              {!isCameraMode ? (
                <button
                  onClick={startCamera}
                  disabled={!isInRadius}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  Kirim Absen
                </button>
              ) : (
                <button
                  onClick={handleSaveAttendance}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all animate-[flyIn_0.3s_ease-out]"
                >
                  Simpan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
