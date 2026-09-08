let timeOffset = 0;
let isSynced = false;
let serverValidated = false;
let isSyncing = false; // Kunci agar tidak bentrok/spam request ke server saat HP baru bangun

// ==========================================
// FUNGSI PENCARI WAKTU DUAL-SERVER
// ==========================================
const fetchNetworkTime = async () => {
  try {
    // Tambah konfigurasi { cache: "no-store" } agar iOS Safari tidak mengakali memori cache
    const res1 = await fetch(
      `https://worldtimeapi.org/api/timezone/Etc/UTC?nocache=${Date.now()}`,
      { cache: "no-store" },
    );
    if (res1.ok) {
      const data1 = await res1.json();
      return new Date(data1.datetime).getTime();
    }
    throw new Error("Server 1 gagal");
  } catch (error) {
    const res2 = await fetch(
      `https://timeapi.io/api/Time/current/zone?timeZone=UTC&nocache=${Date.now()}`,
      { cache: "no-store" },
    );
    if (res2.ok) {
      const data2 = await res2.json();
      return new Date(data2.dateTime + "Z").getTime();
    }
    throw new Error("Semua server waktu gagal");
  }
};

export const syncServerTime = async () => {
  if (!navigator.onLine || isSyncing) return;

  isSyncing = true; // Kunci proses
  try {
    const serverTime = await fetchNetworkTime();
    const localTime = Date.now();

    timeOffset = serverTime - localTime;
    isSynced = true;

    // LAPIS 1: HAKIM ONLINE (Toleransi 5 Menit)
    if (Math.abs(timeOffset) > 300000) {
      localStorage.setItem("is_time_manipulated", "true");
      serverValidated = false;
    } else {
      // HAPUS KUNCI SECARA PAKSA!
      localStorage.removeItem("is_time_manipulated");
      serverValidated = true;
      localStorage.setItem("last_valid_time", localTime.toString());
    }
  } catch (error) {
    console.warn("Gagal menyinkronkan waktu. Menunggu percobaan berikutnya.");
  } finally {
    isSyncing = false; // Buka kunci proses
  }
};

export const getSecureTime = () => {
  const currentLocalTime = Date.now();
  const lastSavedTime = localStorage.getItem("last_valid_time");

  // LAPIS 2: ANTI-REWIND (Mencegah mesin waktu ke masa lalu saat offline)
  if (
    !serverValidated &&
    lastSavedTime &&
    currentLocalTime < parseInt(lastSavedTime)
  ) {
    localStorage.setItem("is_time_manipulated", "true");
  }

  // Rekam jejak waktu tertinggi
  if (
    !lastSavedTime ||
    currentLocalTime > parseInt(lastSavedTime) ||
    serverValidated
  ) {
    localStorage.setItem("last_valid_time", currentLocalTime.toString());
  }

  return new Date(currentLocalTime + timeOffset);
};

export const checkTimeTampering = () => {
  return localStorage.getItem("is_time_manipulated") === "true";
};

// ==========================================
// LAPIS 3: REAL-TIME BACKGROUND SENSOR (KHUSUS iPHONE & TANPA REFRESH)
// ==========================================
if (typeof window !== "undefined") {
  // A. Deteksi saat aplikasi kembali difokuskan/dibuka dari Background (Setelah ubah Pengaturan HP)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // PAKSA SINKRONISASI SEKETIKA!
      syncServerTime();
    }
  });

  // B. Deteksi instan saat jaringan HP kembali menyala dari Airplane Mode
  window.addEventListener("online", () => {
    syncServerTime();
  });

  // C. Sensor Loncatan Waktu (Drift Detector)
  let lastTick = Date.now();
  let lastPerf = performance.now();

  setInterval(() => {
    const currentTick = Date.now();
    const currentPerf = performance.now();

    const tickDelta = currentTick - lastTick;
    const perfDelta = currentPerf - lastPerf;

    // Jika beda waktu antara jam sistem kalender dan mesin HP melebihi 3 detik.
    // (Terjadi saat user mengubah jam paksa, ATAU saat HP baru bangun dari layar mati/Sleep)
    if (Math.abs(tickDelta - perfDelta) > 3000) {
      serverValidated = false;
      // Jangan langsung memvonis bersalah (karena bisa jadi dia cuma Sleep).
      // Paksa saja panggil hakim server untuk mengecek kebenaran jam barunya!
      if (navigator.onLine) {
        syncServerTime();
      }
    }

    lastTick = currentTick;
    lastPerf = currentPerf;
  }, 1000);
}
