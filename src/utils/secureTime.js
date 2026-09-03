let timeOffset = 0;
let isSynced = false;
let timeManipulated = localStorage.getItem("is_time_manipulated") === "true";

const initDateNow = Date.now();
const initPerfNow = performance.now();

const lockApp = () => {
  timeManipulated = true;
  localStorage.setItem("is_time_manipulated", "true");
};

// ==========================================
// PERBAIKAN: Fungsi Membuka Kunci
// ==========================================
const unlockApp = () => {
  timeManipulated = false;
  localStorage.removeItem("is_time_manipulated");

  // HAPUS PARADOKS MASA DEPAN:
  // Paksa reset rekam jejak waktu ke masa sekarang agar Detektor Lapis 2
  // tidak langsung mengunci ulang aplikasinya.
  localStorage.setItem("last_valid_time", Date.now().toString());
};

// Tambahkan parameter `force` agar bisa dipanggil paksa meski sudah sync
export const syncServerTime = async (force = false) => {
  if ((isSynced && !force) || !navigator.onLine) return;

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

    if (Math.abs(timeOffset) > 180000) {
      lockApp();
    } else {
      unlockApp();
    }
  } catch (error) {
    console.warn("Gagal menghubungi server waktu.");
    isSynced = true;
  }
};

export const getSecureTime = () => {
  const currentLocalTime = Date.now();

  const lastSavedTime = localStorage.getItem("last_valid_time");
  if (lastSavedTime && currentLocalTime < parseInt(lastSavedTime)) {
    lockApp();
  }

  if (!lastSavedTime || currentLocalTime > parseInt(lastSavedTime)) {
    localStorage.setItem("last_valid_time", currentLocalTime.toString());
  }

  return new Date(currentLocalTime + timeOffset);
};

export const checkTimeTampering = () => {
  if (timeManipulated) return true;

  const elapsedHardware = performance.now() - initPerfNow;
  const elapsedSystem = Date.now() - initDateNow;

  if (Math.abs(elapsedSystem - elapsedHardware) > 10000) {
    lockApp();
  }

  return timeManipulated;
};
