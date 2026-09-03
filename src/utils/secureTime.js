let timeOffset = 0;
let isSynced = false;

// ==========================================
// INISIALISASI STATUS DARI MEMORI PERMANEN
// Membaca apakah HP ini sedang dalam status "Terkunci" akibat curang sebelumnya
// ==========================================
let timeManipulated = localStorage.getItem("is_time_manipulated") === "true";

const initDateNow = Date.now();
const initPerfNow = performance.now();

// Fungsi untuk Mengunci Aplikasi Permanen
const lockApp = () => {
  timeManipulated = true;
  localStorage.setItem("is_time_manipulated", "true");
};

// Fungsi untuk Membuka Kunci (Hanya bisa dipanggil jika internet menyala & jam akurat)
const unlockApp = () => {
  timeManipulated = false;
  localStorage.removeItem("is_time_manipulated");
};

export const syncServerTime = async () => {
  if (isSynced || !navigator.onLine) return;

  try {
    const response = await fetch(
      "https://worldtimeapi.org/api/timezone/Etc/UTC",
    );
    if (!response.ok) throw new Error("API gagal");

    const data = await response.json();
    const serverTime = new Date(data.datetime).getTime();
    const localTime = Date.now();

    timeOffset = serverTime - localTime;
    isSynced = true;

    // ==========================================
    // LAPIS 1: HAKIM ONLINE (Bisa Menghukum, Bisa Mengampuni)
    // ==========================================
    if (Math.abs(timeOffset) > 180000) {
      // Selisih > 3 Menit: KUNCI PERMANEN
      lockApp();
    } else {
      // Jam terbukti sudah disinkronkan dan akurat: BUKA KUNCI
      unlockApp();
    }
  } catch (error) {
    console.warn("Gagal menghubungi server waktu. Mengandalkan deteksi lokal.");
    isSynced = true;
  }
};

export const getSecureTime = () => {
  const currentLocalTime = Date.now();

  // ==========================================
  // LAPIS 2: ANTI-REWIND (Mencegah mesin waktu ke masa lalu)
  // ==========================================
  const lastSavedTime = localStorage.getItem("last_valid_time");
  if (lastSavedTime && currentLocalTime < parseInt(lastSavedTime)) {
    lockApp(); // Ketahuan mundur ke masa lalu -> KUNCI PERMANEN
  }

  // Simpan rekam jejak waktu tertinggi (High Watermark)
  if (!lastSavedTime || currentLocalTime > parseInt(lastSavedTime)) {
    localStorage.setItem("last_valid_time", currentLocalTime.toString());
  }

  return new Date(currentLocalTime + timeOffset);
};

export const checkTimeTampering = () => {
  // Jika sudah terkunci dari memori (akibat refresh/tutup paksa), tolak mentah-mentah!
  if (timeManipulated) return true;

  // ==========================================
  // LAPIS 3: DETEKTOR REAL-TIME (Sensor Detak Hardware)
  // ==========================================
  const elapsedHardware = performance.now() - initPerfNow;
  const elapsedSystem = Date.now() - initDateNow;

  // Jika mendadak waktu OS melompat melebihi toleransi kelambatan HP (10 detik)
  if (Math.abs(elapsedSystem - elapsedHardware) > 10000) {
    lockApp(); // Terdeteksi melompat -> KUNCI PERMANEN
  }

  return timeManipulated;
};
