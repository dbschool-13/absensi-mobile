import { useState, useEffect, useCallback, useRef } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export const useGeolocation = () => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  const watchIdRef = useRef(null);

  // =====================================================================
  // 1. FUNGSI PAKSA REFRESH (Panggil manual lewat tombol di UI)
  // =====================================================================
  const refreshLocation = useCallback(async () => {
    setLocation((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== "granted") {
          setLocation((prev) => ({
            ...prev,
            error: "Izin lokasi ditolak. Buka Pengaturan HP untuk mengizinkan.",
            loading: false,
          }));
          return;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });

      const acc = position.coords.accuracy;

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: acc,
        error:
          acc > 60 ? "Sinyal satelit lemah, mencari posisi presisi..." : null,
        loading: false,
      });
    } catch (error) {
      setLocation((prev) => ({
        ...prev,
        error: "Gagal mengunci GPS. Harap ke ruang terbuka/luar gedung.",
        loading: false,
      }));
    }
  }, []);

  // =====================================================================
  // 2. FUNGSI PANTAU OTOMATIS (Berjalan di latar belakang)
  // =====================================================================
  useEffect(() => {
    let isMounted = true;
    let jumpTimeout = null; // Timer pelepasan Jump Protector

    const startWatching = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const permission = await Geolocation.requestPermissions();
          if (permission.location !== "granted") {
            if (isMounted) {
              setLocation((prev) => ({
                ...prev,
                error: "Izin lokasi ditolak.",
                loading: false,
              }));
            }
            return;
          }
        }

        // Pancingan awal agar tidak kosong
        refreshLocation();

        // Pantau pergerakan secara Live
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
          (position, err) => {
            if (!isMounted) return;

            if (position) {
              const acc = position.coords.accuracy;

              setLocation((prev) => {
                // ================================================================
                // SMART JUMP PROTECTOR
                // Jika lokasi loncat jelek (> 100m) tapi sebelumnya bagus (< 50m),
                // tolak data baru tersebut selama maksimal 10 DETIK.
                // Jika setelah 10 detik datanya masih jelek, berarti guru memang pindah.
                // ================================================================
                if (prev.accuracy && prev.accuracy < 50 && acc > 100) {
                  // Jika belum ada timer, buat timer 10 detik
                  if (!jumpTimeout) {
                    jumpTimeout = setTimeout(() => {
                      // Setelah 10 detik berlalu, reset akurasi agar sistem mau menerima lokasi jelek
                      setLocation((p) => ({ ...p, accuracy: 999 }));
                      jumpTimeout = null;
                    }, 10000);
                  }

                  return prev; // Pertahankan titik lama
                }

                // Jika data yang masuk bagus, hapus timer (jika ada)
                if (acc <= 100 && jumpTimeout) {
                  clearTimeout(jumpTimeout);
                  jumpTimeout = null;
                }

                return {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: acc,
                  error:
                    acc > 80
                      ? `Sinyal lemah (Melenceng ~${Math.round(acc)}m)`
                      : null,
                  loading: false,
                };
              });
            } else if (err) {
              setLocation((prev) => ({
                ...prev,
                error: prev.latitude ? prev.error : "Mencari satelit GPS...",
                loading: prev.latitude ? false : true,
              }));
            }
          },
        );

        watchIdRef.current = id;
      } catch (error) {
        if (isMounted) {
          setLocation((prev) => ({
            ...prev,
            error: "Modul GPS bermasalah.",
            loading: false,
          }));
        }
      }
    };

    startWatching();

    // =====================================================================
    // 3. PEMBERSIHAN MEMORI (Mencegah HP Panas / Memory Leak)
    // =====================================================================
    return () => {
      isMounted = false;
      if (jumpTimeout) clearTimeout(jumpTimeout);

      // Menggunakan identifier yang benar untuk membersihkan WatchPosition di Capacitor
      if (watchIdRef.current != null) {
        Geolocation.clearWatch({ id: watchIdRef.current });
      }
    };
  }, []); // <-- PERBAIKAN KRITIS: Dependency dikosongkan agar Effect hanya berjalan 1x saat komponen dipasang

  return { ...location, refreshLocation };
};
