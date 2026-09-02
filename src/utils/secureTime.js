let timeOffset = 0;
let isSynced = false; // Tambahkan flag penanda ini

export const syncServerTime = async () => {
  // Jika sudah pernah sinkron (atau sedang offline), jangan tembak API lagi!
  if (isSynced || !navigator.onLine) return;

  try {
    const response = await fetch("https://worldtimeapi.org/api/ip");
    if (!response.ok) throw new Error("Gagal mengambil waktu");

    const data = await response.json();
    const serverTime = new Date(data.datetime).getTime();
    const localTime = new Date().getTime();

    timeOffset = serverTime - localTime;
    isSynced = true; // Kunci agar tidak spam fetch API lagi
  } catch (error) {
    console.warn("Gagal sinkron waktu global. Menggunakan waktu lokal.");
    isSynced = true; // Kunci juga jika gagal, agar tidak terus-terusan mencoba dan diblokir
  }
};

export const getSecureTime = () => {
  const currentLocalTime = new Date().getTime();
  return new Date(currentLocalTime + timeOffset);
};
