let timeOffset = 0;
let isSynced = false;
let serverValidated = false;

// ==========================================
// FUNGSI PENCARI WAKTU DUAL-SERVER
// Jika Server 1 diblokir (Rate Limit), otomatis pindah ke Server 2
// ==========================================
const fetchNetworkTime = async () => {
  try {
    // Coba Server 1 (WorldTimeAPI) - Tambah nocache agar tidak nyangkut
    const res1 = await fetch(
      `https://worldtimeapi.org/api/timezone/Etc/UTC?nocache=${Date.now()}`,
    );
    if (res1.ok) {
      const data1 = await res1.json();
      return new Date(data1.datetime).getTime();
    }
    throw new Error("Server 1 gagal");
  } catch (error) {
    // Coba Server 2 (TimeAPI.io) jika Server 1 error
    const res2 = await fetch(
      "https://timeapi.io/api/Time/current/zone?timeZone=UTC",
    );
    if (res2.ok) {
      const data2 = await res2.json();
      // Tambahkan "Z" untuk memastikan format UTC
      return new Date(data2.dateTime + "Z").getTime();
    }
    throw new Error("Semua server waktu gagal");
  }
};

export const syncServerTime = async () => {
  if (!navigator.onLine) return; // Jika offline, abaikan

  try {
    const serverTime = await fetchNetworkTime();
    const localTime = Date.now();

    timeOffset = serverTime - localTime;
    isSynced = true;

    // ==========================================
    // LAPIS 1: HAKIM ONLINE (Toleransi dinaikkan menjadi 5 Menit)
    // 5 Menit = 300.000 milidetik
    // ==========================================
    if (Math.abs(timeOffset) > 300000) {
      // Jika selisih > 5 menit, KUNCI.
      localStorage.setItem("is_time_manipulated", "true");
      serverValidated = false;
    } else {
      // JAM TERBUKTI BENAR! HAPUS KUNCI SECARA PAKSA!
      localStorage.removeItem("is_time_manipulated");
      serverValidated = true;

      // Hapus jebakan masa depan palsu
      localStorage.setItem("last_valid_time", localTime.toString());
    }
  } catch (error) {
    console.warn("Gagal menyinkronkan waktu. Menunggu percobaan berikutnya.");
    // Biarkan state apa adanya agar dia mencoba lagi nanti
  }
};

export const getSecureTime = () => {
  const currentLocalTime = Date.now();
  const lastSavedTime = localStorage.getItem("last_valid_time");

  // ==========================================
  // LAPIS 2: ANTI-REWIND (Mencegah mesin waktu ke masa lalu)
  // Berlaku HANYA JIKA belum divalidasi oleh Server (Offline)
  // ==========================================
  if (
    !serverValidated &&
    lastSavedTime &&
    currentLocalTime < parseInt(lastSavedTime)
  ) {
    localStorage.setItem("is_time_manipulated", "true");
  }

  // Rekam jejak waktu tertinggi (High Watermark)
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
  // Hanya membaca status dari LocalStorage, tidak lagi menggunakan
  // sensor CPU yang bermasalah saat HP sedang di "Sleep / Layar Mati"
  return localStorage.getItem("is_time_manipulated") === "true";
};
