// src/utils/secureTime.js

/**
 * Sinkronisasi waktu dengan Server Global (World Time API)
 * Panggil fungsi ini saat aplikasi pertama kali dimuat.
 */
export const syncServerTime = async () => {
  try {
    // Menggunakan API publik yang ringan (mengembalikan waktu UTC murni)
    const response = await fetch("https://worldtimeapi.org/api/ip");
    const data = await response.json();

    const serverTime = new Date(data.utc_datetime).getTime();
    const localTime = Date.now();

    // Hitung selisih: Waktu Server - Waktu HP
    const offset = serverTime - localTime;

    // Simpan selisih secara lokal
    localStorage.setItem("secure_time_offset", offset.toString());

    return offset;
  } catch (error) {
    console.error(
      "Gagal sinkron waktu global. Menggunakan waktu lokal.",
      error,
    );
    // Jika tidak ada internet saat baru buka, gunakan selisih yang tersimpan sebelumnya
    // Atau 0 jika belum pernah sinkron
    if (!localStorage.getItem("secure_time_offset")) {
      localStorage.setItem("secure_time_offset", "0");
    }
    return 0;
  }
};

/**
 * Dapatkan Waktu Aktual Anti-Manipulasi
 * Gunakan fungsi ini sebagai pengganti `new Date()` di seluruh aplikasi.
 */
export const getSecureTime = () => {
  const offset = parseInt(
    localStorage.getItem("secure_time_offset") || "0",
    10,
  );
  const secureTimestamp = Date.now() + offset;
  return new Date(secureTimestamp);
};
