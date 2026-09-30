import {
  getSecureTime,
  syncServerTime,
  checkTimeTampering,
} from "../../utils/secureTime";
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useGeolocation } from "../../hooks/useGeolocation";
import { calculateDistance } from "../../utils/distanceCalculator";
import { attendanceService } from "../../services/attendanceService";
import RadiusMap from "../../components/map/RadiusMap";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle,
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
  Clock,
} from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { id } from "date-fns/locale";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";

// Helper Anti-Error untuk semua jenis HP (iOS/Android)
const getValidTime = (timeData) => {
  if (!timeData) return new Date();
  if (typeof timeData.toDate === "function") return timeData.toDate();
  let parsedStr = timeData;
  if (typeof timeData === "string") parsedStr = timeData.replace(" ", "T");
  const d = new Date(parsedStr);
  if (isNaN(d.getTime())) return new Date();
  return d;
};

// Komponen Jam Mandiri
const LiveClock = () => {
  const [time, setTime] = useState(getSecureTime());
  useEffect(() => {
    const timer = setInterval(() => setTime(getSecureTime()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <h1 className="text-4xl font-black tracking-tight drop-shadow-sm flex items-baseline justify-center">
      {format(time, "HH:mm")}
      <span className="text-xl font-bold opacity-80 ml-1">
        :{format(time, "ss")}
      </span>
    </h1>
  );
};

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

  const currentTime = getSecureTime();
  const [todayAtt, setTodayAtt] = useState(null);

  // --- STATE OFFLINE MODE ---
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [weeklyTotalPastDays, setWeeklyTotalPastDays] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    type: "",
    time: "",
  });

  useEffect(() => {
    const fetchTodayAtt = async () => {
      if (navigator.onLine) await syncServerTime();
      if (user) {
        const attData = await attendanceService.getTodayAttendance(
          user.nip,
          user.school_id,
        );
        setTodayAtt(attData);
      }
    };
    fetchTodayAtt();
  }, [user]);

  // KODE BARU UNTUK fetchWeeklyData di Dashboard.jsx
  useEffect(() => {
    const fetchWeeklyData = async () => {
      if (!user || isOffline) return;
      try {
        const startOfWk = startOfWeek(currentTime, { weekStartsOn: 1 });
        const endOfWk = endOfWeek(currentTime, { weekStartsOn: 1 });
        const todayStr = format(currentTime, "yyyy-MM-dd");

        // Format tanggal untuk query
        const startStr = format(startOfWk, "yyyy-MM-dd");
        const endStr = format(endOfWk, "yyyy-MM-dd");

        // OPTIMALISASI QUERY: Hanya tarik data rentang minggu ini saja! (Maks 7 dokumen)
        const q = query(
          collection(db, `schools/${user.school_id}/attendances`),
          where("user_id", "==", user.nip),
          where("date", ">=", startStr),
          where("date", "<=", endStr),
        );

        const snap = await getDocs(q);
        let pastTotal = 0;

        snap.forEach((doc) => {
          const data = doc.data();
          if (data.date !== todayStr) {
            const hours = parseFloat(data.total_hours) || 0;
            pastTotal += hours;
          }
        });
        setWeeklyTotalPastDays(pastTotal);
      } catch (error) {
        console.error("Gagal menarik data mingguan:", error);
      }
    };
    fetchWeeklyData();
  }, [user, isOffline]);

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

  useEffect(() => {
    const checkQueue = () => {
      const queue = JSON.parse(
        localStorage.getItem("offline_attendance") || "[]",
      );
      setPendingSync(queue.length);
    };
    checkQueue();

    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Koneksi pulih! Menyinkronkan data...");
      syncOfflineData();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Koneksi terputus! Beralih ke Mode Offline.", { icon: "📡" });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const syncOfflineData = async () => {
    const queue = JSON.parse(
      localStorage.getItem("offline_attendance") || "[]",
    );
    if (queue.length === 0) return;

    setGlobalLoading(true);

    try {
      // Eksekusi seluruh antrean sekaligus lewat metode Batch
      const isSuccess = await attendanceService.syncOfflineBatch(queue);

      if (isSuccess) {
        toast.success(`${queue.length} data absen offline terkirim!`);
        // Kosongkan antrean lokal
        localStorage.removeItem("offline_attendance");
        setPendingSync(0);

        // Segarkan data dashboard
        const attData = await attendanceService.getTodayAttendance(
          user.nip,
          user.school_id,
        );
        setTodayAtt(attData);
      } else {
        toast.error("Gagal menyinkronkan data offline. Mencoba lagi nanti.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setGlobalLoading(false);
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setIsModalOpen(true);
    setIsMapReady(false);
    setTimeout(() => setIsMapReady(true), 400);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    setIsMapReady(false);
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const timestampAsli = getSecureTime().toISOString();
      if (isOffline) {
        const attendancePayload = {
          id: Date.now().toString(),
          type: modalType,
          nip: user.nip,
          school_id: user.school_id,
          lat: latitude,
          lng: longitude,
          distance: distance,
          timestamp: timestampAsli,
          checkInTime: todayAtt?.check_in?.time || null,
        };
        const queue = JSON.parse(
          localStorage.getItem("offline_attendance") || "[]",
        );
        queue.push(attendancePayload);
        localStorage.setItem("offline_attendance", JSON.stringify(queue));
        setPendingSync(queue.length);
        toast.success("📶 Disimpan offline. Dikirim otomatis saat online.");
        closeModal();
      } else {
        let result = null;
        if (modalType === "datang") {
          result = await attendanceService.checkIn(
            user.nip,
            user.school_id,
            latitude,
            longitude,
            distance,
            null,
            timestampAsli,
          );
          if (result) setTodayAtt({ ...todayAtt, ...result });
        } else if (modalType === "pulang") {
          result = await attendanceService.checkOut(
            user.nip,
            user.school_id,
            latitude,
            longitude,
            distance,
            todayAtt.check_in.time,
            null,
            timestampAsli,
          );
          if (result) setTodayAtt((prev) => ({ ...prev, ...result }));
        }

        if (result) {
          closeModal();
          setSuccessModal({
            isOpen: true,
            type: modalType,
            time: format(new Date(timestampAsli), "HH:mm"),
          });
        }
      }
    } catch (error) {
      toast.error("Terjadi kesalahan.");
      closeModal();
    } finally {
      setIsSaving(false);
    }
  };

  const [isTimeManipulated, setIsTimeManipulated] = useState(false);
  const [calcTime, setCalcTime] = useState(getSecureTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setCalcTime(getSecureTime());
      setIsTimeManipulated(checkTimeTampering());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAutoInject =
    todayAtt?.is_auto_injected === true ||
    todayAtt?.check_in?.time === "[AUTO-INJECT]";
  const isLeaveZero = isAutoInject && todayAtt?.total_hours === 0;
  const isLeaveFull = isAutoInject && todayAtt?.total_hours >= 8;

  let leaveLabel = "IZIN";
  if (isAutoInject && todayAtt?.status) {
    leaveLabel = todayAtt.status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

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

  const isDatangTutup =
    currentHM > timeRules.check_in_end || currentHM > timeRules.check_out_end;
  const isPulangTutup = currentHM > timeRules.check_out_end;

  const targetMinutes = 8 * 60;
  let workedMinutes = 0;

  if (isLeaveZero) {
    workedMinutes = 0;
  } else if (isLeaveFull) {
    workedMinutes = targetMinutes;
  } else if (hasCheckedIn) {
    const checkInDate = getValidTime(todayAtt.check_in.time);
    let endTime = calcTime;
    if (hasCheckedOut) endTime = getValidTime(todayAtt.check_out.time);

    let diffMs = endTime.getTime() - checkInDate.getTime();
    if (diffMs < 0) diffMs = 0;
    workedMinutes = Math.floor(diffMs / (1000 * 60));
  }

  workedMinutes = Math.max(workedMinutes, 0);

  const progressPercent = Math.min((workedMinutes / targetMinutes) * 100, 100);
  const hoursWorked = Math.floor(workedMinutes / 60);
  const minsWorked = workedMinutes % 60;

  const shortfallMinutes = Math.max(targetMinutes - workedMinutes, 0);
  const shortHours = Math.floor(shortfallMinutes / 60);
  const shortMins = shortfallMinutes % 60;

  let shortText = "Kurang ";
  if (shortHours > 0) shortText += `${shortHours}j `;
  shortText += `${shortMins}m`;

  const targetWeeklyHours = workingDaysDef.length * 8;
  const targetWeeklyMinutes = targetWeeklyHours * 60;
  const totalWeeklyMinutesSoFar =
    weeklyTotalPastDays * 60 + Math.max(workedMinutes, 0);
  const weeklyDeficitMinutes = Math.max(
    targetWeeklyMinutes - totalWeeklyMinutesSoFar,
    0,
  );
  const deficitHours = Math.floor(weeklyDeficitMinutes / 60);
  const deficitMins = Math.floor(weeklyDeficitMinutes % 60);

  let weeklyBadgeText = "Tercapai";
  if (weeklyDeficitMinutes > 0) {
    weeklyBadgeText = `Kurang ${deficitHours}j ${deficitMins}m`;
  }

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-30 font-sans overflow-x-hidden relative">
      {/* BACKGROUND WATERMARK */}
      {schoolData?.logo_url && (
        <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
          <img
            src={schoolData.logo_url}
            alt="Watermark"
            className="w-[80vw] max-w-sm opacity-[0.08] object-contain "
          />
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-gradient-to-b from-primary to-primary_dark text-white pt-10 pb-20 px-6 rounded-b-[2rem] shadow-sm relative z-10">
        <div className="flex justify-between items-center relative z-10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
              <UserIcon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] text-indigo-200 font-medium tracking-wide">
                {getGreeting()},
              </p>
              <h2 className="text-sm font-semibold text-white tracking-wide line-clamp-1">
                {user?.name || "Pegawai"}
              </h2>
            </div>
          </div>
          <div className="w-14 h-14 rounded-full flex items-center justify-center p-1 shadow-sm">
            {schoolData?.logo_url ? (
              <img
                src={schoolData.logo_url}
                alt="Logo"
                className="w-full h-full object-contain rounded-full"
              />
            ) : (
              <School size={18} className="text-indigo-500" />
            )}
          </div>
        </div>

        <div className="relative z-10 text-center flex flex-col items-center">
          <p className="text-xs text-indigo-100 mb-1 font-medium tracking-wide">
            {format(currentTime, "EEEE, dd MMMM yyyy", { locale: id })}
          </p>
          <LiveClock />
        </div>

        {pendingSync > 0 && (
          <div className="absolute top-4 right-1/2 translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-semibold shadow-md flex items-center gap-1.5 animate-pulse z-20">
            <RefreshCw size={12} className={isOffline ? "" : "animate-spin"} />
            {pendingSync} Sync
          </div>
        )}
      </div>

      <div className="-mt-12 mx-5 space-y-4 relative z-20">
        {/* STATUS PANEL */}
        <div className="bg-white/95 backdrop-blur-sm rounded-[1.5rem] opacity-[12] shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
                  isInRadius
                    ? "bg-emerald-50 text-emerald-500"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {gpsLoading ? (
                  <Navigation size={18} className="animate-spin" />
                ) : isInRadius ? (
                  <MapPin size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
              </div>
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Lokasi
                </h3>
                <h3 className="text-xs font-bold text-gray-800">
                  {gpsLoading
                    ? "Mencari GPS..."
                    : isInRadius
                    ? "Dalam Area"
                    : "Di Luar Area"}
                </h3>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                  isInRadius
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {distance !== null ? `${distance}m` : "--"}
              </div>
              <button
                onClick={refreshLocation}
                disabled={gpsLoading}
                className="text-[10px] text-indigo-500 font-medium flex items-center gap-1 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw
                  size={10}
                  className={gpsLoading ? "animate-spin" : ""}
                />{" "}
                Refresh
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-[10px] font-medium text-gray-500">
              Jadwal Hari Ini
            </span>
            {isWorkingDay ? (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <CalendarCheck size={12} /> Hari Kerja
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-red-500 flex items-center gap-1">
                <CalendarX size={12} /> Libur
              </span>
            )}
          </div>
        </div>

        {/* ACTION PANELS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-center">
              <span className="bg-emerald-200/90 backdrop-blur-sm text-gray-800 text-[10px] font-medium px-3 py-1 rounded-full shadow-sm border border-white">
                {timeRules.check_in_start} - {timeRules.check_in_end}
              </span>
            </div>
            <div className="bg-white/95 backdrop-blur-sm rounded-[1.5rem] shadow-sm border border-gray-100 p-4 flex flex-col items-center justify-center opacity-[0.8]">
              <div className="p-2 bg-emerald-50 rounded-full mb-2">
                <LogIn size={18} className="text-emerald-500" />
              </div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Masuk
              </span>
              <p className="text-2xl font-bold text-gray-800">
                {isAutoInject ? (
                  <span className="text-base text-emerald-600">
                    {leaveLabel}
                  </span>
                ) : hasCheckedIn ? (
                  format(
                    todayAtt.check_in.time?.toDate
                      ? todayAtt.check_in.time.toDate()
                      : new Date(todayAtt.check_in.time),
                    "HH:mm",
                  )
                ) : (
                  "--:--"
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-center">
              <span className="bg-red-300/90 backdrop-blur-sm text-gray-800 text-[10px] font-medium px-3 py-1 rounded-full shadow-sm border border-white">
                {timeRules.check_out_start} - {timeRules.check_out_end}
              </span>
            </div>
            <div className="bg-white/95 backdrop-blur-sm rounded-[1.5rem] shadow-sm border border-gray-100 p-4 flex flex-col items-center justify-center opacity-[0.8]">
              <div className="p-2 bg-red-50 rounded-full mb-2">
                <LogOut size={18} className="text-red-500" />
              </div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Pulang
              </span>
              <p className="text-2xl font-bold text-gray-800">
                {isAutoInject ? (
                  <span className="text-base text-emerald-600">
                    {leaveLabel}
                  </span>
                ) : hasCheckedOut ? (
                  format(
                    todayAtt.check_out.time?.toDate
                      ? todayAtt.check_out.time.toDate()
                      : new Date(todayAtt.check_out.time),
                    "HH:mm",
                  )
                ) : (
                  "--:--"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* LINEAR PROGRESS PANEL */}
        <div className="bg-white/95 backdrop-blur-sm rounded-[1.5rem] shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-md font-bold text-gray-800">
                {hoursWorked} Jam{" "}
                <span className="text-xs font-medium text-gray-500">
                  {minsWorked} menit
                </span>
              </h3>
              <p
                className={`text-[11px] font-medium ${
                  isLeaveZero
                    ? "text-red-500"
                    : isLeaveFull
                    ? "text-emerald-500"
                    : hasCheckedOut && progressPercent < 100
                    ? "text-orange-500"
                    : "text-gray-500"
                }`}
              >
                {isLeaveZero
                  ? "Bebas Tugas (0 Jam)"
                  : isLeaveFull
                  ? "Hadir Penuh (Izin)"
                  : hasCheckedOut
                  ? progressPercent >= 100
                    ? "Target Harian Terpenuhi"
                    : `⚠️ ${shortText}`
                  : hasCheckedIn
                  ? "Durasi sedang berjalan..."
                  : "Belum mulai absen"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-md font-bold text-gray-800">
                {Math.round(progressPercent)}%
              </span>
              <p className="text-[10px] font-medium text-gray-400">
                Target 8 Jam
              </p>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                isLeaveZero ? "bg-red-500" : "bg-indigo-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-medium text-gray-400">
              Mingguan ({targetWeeklyHours} Jam)
            </span>
            <span
              className={`text-[9px] font-semibold px-2 py-0.5 rounded transition-colors ${
                weeklyDeficitMinutes <= 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-orange-50 text-orange-600"
              }`}
            >
              {weeklyBadgeText}
            </span>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BAR */}
      <div className="fixed bottom-[80px] left-0 w-full px-5 z-40">
        {isTimeManipulated ? (
          <div className="bg-white/95 backdrop-blur p-4 rounded-[1.5rem] shadow-lg border border-red-100 flex flex-col items-center text-center">
            <Clock size={24} className="text-red-500 mb-2" />
            <h3 className="font-bold text-gray-800 text-sm mb-1">
              Waktu Tidak Sinkron
            </h3>
            <p className="text-[10px] text-gray-500">
              Aktifkan "Waktu Otomatis" di pengaturan perangkat.
            </p>
          </div>
        ) : isLeaveZero || isLeaveFull ? (
          <div className="bg-white/95 backdrop-blur p-4 rounded-[1.5rem] shadow-md border border-orange-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shrink-0">
              <CalendarCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">{leaveLabel}</h3>
              <p className="text-[10px] text-gray-500">Tercatat pada sistem.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-xl p-2 rounded-[1.5rem] shadow-lg border border-gray-100 flex gap-2">
            <button
              onClick={() => openModal("datang")}
              disabled={
                !isInRadius ||
                gpsLoading ||
                hasCheckedIn ||
                !isCheckInTimeValid ||
                !isWorkingDay ||
                isDatangTutup
              }
              className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                hasCheckedIn ||
                (!isCheckInTimeValid && !hasCheckedIn) ||
                !isInRadius ||
                !isWorkingDay ||
                isDatangTutup
                  ? "bg-gray-100 text-gray-400"
                  : "bg-emerald-500 text-white shadow-md active:scale-95"
              }`}
            >
              <span className="flex flex-col items-center">
                {!isWorkingDay
                  ? "Libur"
                  : isDatangTutup
                  ? "Sesi Masuk Ditutup"
                  : hasCheckedIn
                  ? "Sudah Masuk"
                  : "Absen Masuk"}

                {!hasCheckedIn &&
                  isWorkingDay &&
                  !isDatangTutup &&
                  !isCheckInTimeValid && (
                    <span className="text-[9px] uppercase font-bold text-red-400 mt-0.5">
                      Luar Jam
                    </span>
                  )}
              </span>
            </button>

            <button
              onClick={() => openModal("pulang")}
              disabled={
                !isInRadius ||
                !hasCheckedIn ||
                hasCheckedOut ||
                !isCheckOutTimeValid ||
                !isWorkingDay ||
                isPulangTutup
              }
              className={`flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                !hasCheckedIn ||
                hasCheckedOut ||
                (!isCheckOutTimeValid && hasCheckedIn && !hasCheckedOut) ||
                !isInRadius ||
                !isWorkingDay ||
                isPulangTutup
                  ? "bg-gray-100 text-gray-400"
                  : "bg-red-500 text-white shadow-md active:scale-95"
              }`}
            >
              <span className="flex flex-col items-center">
                {!isWorkingDay
                  ? "Libur"
                  : isPulangTutup
                  ? "Sesi Pulang Ditutup"
                  : hasCheckedOut
                  ? "Sudah Pulang"
                  : "Absen Pulang"}

                {hasCheckedIn &&
                  !hasCheckedOut &&
                  isWorkingDay &&
                  !isPulangTutup &&
                  !isCheckOutTimeValid && (
                    <span className="text-[9px] uppercase font-bold text-red-400 mt-0.5">
                      Luar Jam
                    </span>
                  )}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-0" onClick={closeModal}></div>
          <div className="bg-white rounded-t-[2rem] w-full max-w-md overflow-hidden relative z-10 pb-20 pt-2 animate-[slideUp_0.3s_ease-out]">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3"></div>
            <div className="px-5 py-2 flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Konfirmasi {modalType === "datang" ? "Masuk" : "Pulang"}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Pastikan lokasi presisi.
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={isSaving}
                className="p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 space-y-4">
              <div className="h-[180px] w-full bg-gray-100 rounded-[1.5rem] overflow-hidden relative border-2 border-white shadow-inner">
                {latitude &&
                longitude &&
                schoolData?.latitude &&
                schoolData?.longitude &&
                isMapReady ? (
                  <div className="absolute inset-0">
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
                  <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-slate-50">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] text-gray-400 font-medium">
                      Mencari lokasi...
                    </span>
                  </div>
                )}
              </div>

              <div
                className={`p-3 rounded-xl flex items-center justify-center gap-2 border text-sm font-semibold ${
                  isInRadius
                    ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                    : "bg-red-50 border-red-100 text-red-600"
                }`}
              >
                {isInRadius ? (
                  <CheckCircle size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span>
                  {isInRadius
                    ? `Lokasi Sesuai (${distance}m)`
                    : `Di Luar Radius (${distance}m)`}
                </span>
              </div>
            </div>

            <div className="p-5 flex gap-3">
              <button
                onClick={closeModal}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={!isInRadius || isSaving}
                className={`flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 ${
                  isSaving
                    ? "bg-gray-400 opacity-80"
                    : "bg-emerald-500 hover:bg-indigo-700 active:scale-95"
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Menyimpan
                  </>
                ) : (
                  "Konfirmasi"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {successModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-5">
          <div className="bg-white rounded-[2rem] w-full max-w-xs overflow-hidden relative z-10 p-6 flex flex-col items-center text-center animate-[scaleIn_0.2s_ease-out]">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={36} className="text-emerald-500" />
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Berhasil{" "}
              {successModal.type === "datang" ? "Absen Masuk" : "Absen Pulang"}
            </h3>

            <div className="bg-gray-50 px-5 py-2 rounded-lg mb-4 mt-2 border border-gray-100">
              <p className="text-2xl font-black text-emerald-600">
                {successModal.time}
              </p>
            </div>

            <p className="text-xs text-gray-500 mb-6">
              {successModal.type === "datang"
                ? "Selamat Bekerja Hari ini."
                : "Terima Kasih. Selamat Beristirahat."}
            </p>

            <button
              onClick={() =>
                setSuccessModal({ isOpen: false, type: "", time: "" })
              }
              className="w-full py-3 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 active:scale-95"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
