let timeOffset = 0;
let isSynced = false;
let serverValidated = false;
let isSyncing = false;

// Penanda waktu inisialisasi aplikasi untuk mencegah false positive saat cold start
const appLoadTime = Date.now();

// ==========================================
// FUNGSI PENCARI WAKTU DUAL-SERVER
// ==========================================
const fetchNetworkTime = async () => {
  try {
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

    // Toleransi online 5 menit (300000 ms)
    if (Math.abs(timeOffset) > 300000) {
      localStorage.setItem("is_time_manipulated", "true");
      serverValidated = false;
    } else {
      // Waktu valid, hapus kunci manipulasi secara paksa (Self-Healing)
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
    // Berikan toleransi kecil 5 detik untuk mengantisipasi selisih mikro
    if (parseInt(lastSavedTime) - currentLocalTime > 5000) {
      localStorage.setItem("is_time_manipulated", "true");
    }
  }

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
    // ABAIKAN pengecekan selama 5 detik pertama setelah aplikasi dimuat (Cold Start Protection)
    if (Date.now() - appLoadTime < 5000) return;

    const currentTick = Date.now();
    const currentPerf = performance.now();

    const tickDelta = currentTick - lastTick;
    const perfDelta = currentPerf - lastPerf;

    // Batas toleransi dinaikkan dari 3 detik ke 8 detik untuk mencegah false positive
    if (Math.abs(tickDelta - perfDelta) > 8000) {
      localStorage.setItem("is_time_manipulated", "true");
      serverValidated = false;

      if (navigator.onLine) {
        syncServerTime();
      }
    }

    lastTick = currentTick;
    lastPerf = currentPerf;
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Reset acuan waktu saat aplikasi dibuka kembali dari background untuk cegah loncatan palsu
      lastTick = Date.now();
      lastPerf = performance.now();

      if (navigator.onLine) syncServerTime();
    }
  });

  window.addEventListener("online", () => {
    syncServerTime();
  });

  // Jalankan sinkronisasi awal saat skrip dimuat jika ada koneksi
  if (navigator.onLine) {
    syncServerTime();
  }

  setInterval(checkDrift, 1000);
}
