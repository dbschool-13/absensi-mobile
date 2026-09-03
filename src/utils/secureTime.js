let timeOffset = 0;
let isSynced = false;
let timeManipulated = false;

// ==========================================
// INISIALISASI SENSOR HARDWARE
// Mencatat waktu saat aplikasi pertama kali dibuka (Boot Time)
// ==========================================
const initDateNow = Date.now(); // Waktu sistem OS (bisa dimanipulasi)
const initPerfNow = performance.now(); // Detak murni CPU (TIDAK BISA dimanipulasi)

export const syncServerTime = async () => {
  if (isSynced || !navigator.onLine) return;

  try {
    // Meminta waktu UTC agar tidak ada bentrok zona waktu lokal HP
    const response = await fetch(
      "https://worldtimeapi.org/api/timezone/Etc/UTC",
    );
    if (!response.ok) throw new Error("API gagal");

    const data = await response.json();
    const serverTime = new Date(data.datetime).getTime();
    const localTime = Date.now();

    timeOffset = serverTime - localTime;
    isSynced = true;

    // LAPIS 1: DETEKSI SELISIH JAM ONLINE
    // Jika jam HP selisih lebih dari 3 Menit (180.000 ms) dengan Server Global
    if (Math.abs(timeOffset) > 180000) {
      timeManipulated = true;
    }
  } catch (error) {
    console.warn("Gagal menghubungi server waktu. Mengandalkan deteksi lokal.");
    isSynced = true;
  }
};

export const getSecureTime = () => {
  const currentLocalTime = Date.now();

  // LAPIS 2: ANTI-REWIND (Mencegah mesin waktu ke masa lalu)
  const lastSavedTime = localStorage.getItem("last_valid_time");
  if (lastSavedTime && currentLocalTime < parseInt(lastSavedTime)) {
    timeManipulated = true;
  }
  localStorage.setItem("last_valid_time", currentLocalTime.toString());

  return new Date(currentLocalTime + timeOffset);
};

export const checkTimeTampering = () => {
  // LAPIS 3: DETEKTOR MANIPULASI REAL-TIME (MONOTONIC CLOCK)
  // Membandingkan perjalanan waktu sistem vs perjalanan waktu detak hardware
  const elapsedHardware = performance.now() - initPerfNow;
  const elapsedSystem = Date.now() - initDateNow;

  // Jika guru mengubah jam di pengaturan HP saat aplikasi berjalan/di background,
  // maka elapsedSystem akan melompat (misal mundur/maju 1 jam),
  // sedangkan elapsedHardware HANYA bertambah beberapa detik.
  // Batas toleransi (lag HP) adalah 10 detik (10.000 ms).
  if (Math.abs(elapsedSystem - elapsedHardware) > 10000) {
    timeManipulated = true;
  }

  return timeManipulated;
};
