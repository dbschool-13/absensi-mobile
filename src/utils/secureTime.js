let timeOffset = 0;
let isSynced = false;
let serverValidated = false;
let isSyncing = false;

// ==========================================
// FUNGSI PENCARI WAKTU DUAL-SERVER
// ==========================================
const fetchNetworkTime = async () => {
  try {
    // SERVER 1 UTAMA KINI TIMEAPI (Lebih Kuat & Stabil)
    const res1 = await fetch(
      `https://timeapi.io/api/Time/current/zone?timeZone=UTC&nocache=${Date.now()}`,
      { cache: "no-store" },
    );
    if (res1.ok) {
      const data1 = await res1.json();
      return new Date(data1.dateTime + "Z").getTime();
    }
    throw new Error("Server 1 gagal");
  } catch (error) {
    // SERVER 2 CADANGAN WORLDTIMEAPI
    const res2 = await fetch(
      `https://worldtimeapi.org/api/timezone/Etc/UTC?nocache=${Date.now()}`,
      { cache: "no-store" },
    );
    if (res2.ok) {
      const data2 = await res2.json();
      return new Date(data2.datetime).getTime();
    }
    throw new Error("Semua server waktu gagal");
  }
};

export const syncServerTime = async () => {
  if (!navigator.onLine || isSyncing) return;

  isSyncing = true;
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
      // JAM TERBUKTI BENAR! HAPUS KUNCI SECARA PAKSA
      localStorage.removeItem("is_time_manipulated");
      serverValidated = true;
      localStorage.setItem("last_valid_time", localTime.toString());
    }
  } catch (error) {
    console.warn("Gagal menyinkronkan waktu. Menunggu percobaan berikutnya.");
  } finally {
    isSyncing = false;
  }
};

export const getSecureTime = () => {
  const currentLocalTime = Date.now();
  const lastSavedTime = localStorage.getItem("last_valid_time");

  // LAPIS 2: ANTI-REWIND (Mencegah mundur ke masa lalu saat offline)
  if (
    !serverValidated &&
    lastSavedTime &&
    currentLocalTime < parseInt(lastSavedTime)
  ) {
    localStorage.setItem("is_time_manipulated", "true");
  }

  // Hanya rekam jejak waktu tertinggi JIKA TIDAK SEDANG DIMANIPULASI
  if (localStorage.getItem("is_time_manipulated") !== "true") {
    if (
      !lastSavedTime ||
      currentLocalTime > parseInt(lastSavedTime) ||
      serverValidated
    ) {
      localStorage.setItem("last_valid_time", currentLocalTime.toString());
    }
  }

  return new Date(currentLocalTime + timeOffset);
};

export const checkTimeTampering = () => {
  return localStorage.getItem("is_time_manipulated") === "true";
};

// ==========================================
// LAPIS 3: REAL-TIME BACKGROUND SENSOR (STRICT MODE)
// ==========================================
if (typeof window !== "undefined") {
  let lastTick = Date.now();
  let lastPerf = performance.now();

  const checkDrift = () => {
    const currentTick = Date.now();
    const currentPerf = performance.now();

    const tickDelta = currentTick - lastTick;
    const perfDelta = currentPerf - lastPerf;

    // Jika beda waktu antara jam sistem kalender dan mesin HP melebihi 3 detik.
    if (Math.abs(tickDelta - perfDelta) > 3000) {
      // INI KUNCI UTAMANYA: LANGSUNG KUNCI APLIKASI (MERAH) TANPA TUNGGU SERVER!
      localStorage.setItem("is_time_manipulated", "true");
      serverValidated = false;

      // Paksa sinkronisasi HANYA JIKA online. Jika offline, layar tetap terkunci.
      if (navigator.onLine) {
        syncServerTime();
      }
    }

    lastTick = currentTick;
    lastPerf = currentPerf;
  };

  // A. Deteksi saat aplikasi dibuka dari Background (Setelah ubah Pengaturan HP)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkDrift(); // Cek loncatan seketika
      if (navigator.onLine) syncServerTime();
    }
  });

  // B. Deteksi instan saat jaringan HP kembali menyala dari Airplane Mode
  window.addEventListener("online", () => {
    syncServerTime();
  });

  // C. Pemantauan berdetak setiap 1 detik
  setInterval(checkDrift, 1000);
}
