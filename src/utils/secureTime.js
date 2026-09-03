let timeOffset = 0;
let isSynced = false;
let timeManipulated = false; // Flag status keamanan

export const syncServerTime = async () => {
  if (isSynced || !navigator.onLine) return;

  try {
    const response = await fetch("https://worldtimeapi.org/api/ip");
    if (!response.ok) throw new Error("Gagal mengambil waktu");

    const data = await response.json();
    const serverTime = new Date(data.datetime).getTime();
    const localTime = new Date().getTime();

    timeOffset = serverTime - localTime;
    isSynced = true;

    // ==========================================
    // KEAMANAN LAPIS 1: DETEKSI SELISIH JAM (ONLINE)
    // Jika jam HP telat/kecepatan lebih dari 3 Menit (180.000 milidetik),
    // tandai sebagai MANIPULASI!
    // ==========================================
    if (Math.abs(timeOffset) > 180000) {
      timeManipulated = true;
    }
  } catch (error) {
    console.warn(
      "API TimeServer gagal dihubungi. Keamanan offline diaktifkan.",
    );
    isSynced = true;
  }
};

export const getSecureTime = () => {
  const currentLocalTime = new Date().getTime();

  // ==========================================
  // KEAMANAN LAPIS 2: ANTI "TIME TRAVEL" (OFFLINE)
  // Mencegah user memundurkan jam ke masa lalu saat tidak ada internet
  // ==========================================
  const lastSavedTime = localStorage.getItem("last_valid_time");
  if (lastSavedTime && currentLocalTime < parseInt(lastSavedTime)) {
    // Jika waktu saat ini LEBIH KECIL (lebih lampau) dari waktu terakhir aplikasi dibuka,
    // maka 100% user memundurkan jam HP-nya!
    timeManipulated = true;
  }

  // Update waktu terakhir aplikasi beroperasi
  localStorage.setItem("last_valid_time", currentLocalTime.toString());

  return new Date(currentLocalTime + timeOffset);
};

// Fungsi untuk dipanggil di Dashboard guna mengecek status keamanan
export const checkTimeTampering = () => {
  return timeManipulated;
};
