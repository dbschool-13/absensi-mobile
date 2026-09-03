let timeOffset = 0;
let isSynced = false;
let timeManipulated = false;

// Variabel Sensor Detak CPU (Runtime Tampering)
let lastRealTime = Date.now();
let lastPerfTime = performance.now();

export const syncServerTime = async () => {
  if (isSynced || !navigator.onLine) return;

  try {
    let serverTimeMs = 0;

    // API UTAMA: WorldTimeAPI
    try {
      const res1 = await fetch("https://worldtimeapi.org/api/ip", {
        cache: "no-store",
      });
      if (res1.ok) {
        const data = await res1.json();
        serverTimeMs = new Date(data.datetime).getTime();
      } else throw new Error();
    } catch (e1) {
      // API CADANGAN: TimeAPI (Aktif jika API utama diblokir/down)
      const res2 = await fetch(
        "https://timeapi.io/api/Time/current/zone?timeZone=UTC",
        { cache: "no-store" },
      );
      if (res2.ok) {
        const data2 = await res2.json();
        serverTimeMs = new Date(data2.dateTime).getTime();
      } else throw new Error();
    }

    const localTime = Date.now();
    timeOffset = serverTimeMs - localTime;
    isSynced = true;

    // LAPIS 1: Toleransi diperketat menjadi 1 Menit (60.000 ms)
    if (Math.abs(timeOffset) > 60000) {
      timeManipulated = true;
    }

    // Simpan sertifikat kalibrasi ke memori HP
    localStorage.setItem("time_calibrated", "true");
    localStorage.setItem("last_valid_time", localTime.toString());
  } catch (error) {
    console.warn("Semua TimeServer gagal dihubungi.");
    // LAPIS 2: ANTI HAPUS CACHE (Clear Data Exploit)
    // Jika belum pernah dikalibrasi (habis hapus data) DAN tidak ada internet, langsung KUNCI!
    if (!localStorage.getItem("time_calibrated")) {
      timeManipulated = true;
    }
  }
};

export const getSecureTime = () => {
  const currentLocalTime = Date.now();
  const currentPerfTime = performance.now();

  // LAPIS 3: DETEKSI MANIPULASI SAAT APLIKASI BERJALAN (Runtime Time-Jump)
  // Membandingkan durasi nyala CPU vs durasi jam kalender
  const perfDiff = currentPerfTime - lastPerfTime;
  const realDiff = currentLocalTime - lastRealTime;

  // Jika jam HP diloncatkan > 5 detik saat aplikasi sedang terbuka di background
  if (Math.abs(realDiff - perfDiff) > 5000) {
    timeManipulated = true;
  }

  lastRealTime = currentLocalTime;
  lastPerfTime = currentPerfTime;

  // LAPIS 4: ANTI "TIME TRAVEL" (Offline Rewind)
  const lastSavedTime = localStorage.getItem("last_valid_time");
  if (lastSavedTime) {
    if (currentLocalTime < parseInt(lastSavedTime)) {
      timeManipulated = true;
    }
  }

  // Update rekam jejak waktu hanya jika sistem masih aman
  if (!timeManipulated && isSynced) {
    localStorage.setItem("last_valid_time", currentLocalTime.toString());
  }

  return new Date(currentLocalTime + timeOffset);
};

export const checkTimeTampering = () => {
  return timeManipulated;
};
