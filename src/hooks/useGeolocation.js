import { useState, useEffect, useCallback, useRef } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export const useGeolocation = () => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null, // TAMBAHAN: Memantau radius keakuratan GPS dalam satuan meter
    error: null,
    loading: true,
  });

  // Gunakan ref untuk melacak ID pantauan agar pembersihan memori (cleanup) lebih aman
  const watchIdRef = useRef(null);

  // Fungsi untuk Memaksa Refresh Lokasi (Bisa dipanggil dari tombol)
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

      // Ambil posisi SEKALI SAJA
      // Timeout diperpanjang jadi 20 detik agar hardware GPS punya waktu pemanasan
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
        // Beri peringatan jika akurasi lebih dari 60 meter (sinyal masih menebak-nebak)
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

  useEffect(() => {
    let isMounted = true;

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

        // Panggil refresh pertama kali buka aplikasi
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
                // LOGIKA ANTI-LONCATAN (JUMP PROTECTOR)
                // Jika lokasi sebelumnya sudah sangat akurat (< 50 meter),
                // lalu HP tiba-tiba mengirim data jelek (> 100 meter) karena guru
                // masuk ke dalam gedung tertutup, TOLAK data jelek tersebut!
                // ================================================================
                if (prev.accuracy && prev.accuracy < 50 && acc > 100) {
                  return prev; // Abaikan data baru, pertahankan titik lama yang presisi
                }

                return {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: acc,
                  // Tampilkan peringatan transparan jika satelit masih ngawur
                  error:
                    acc > 80
                      ? `Sinyal lemah (Melenceng ~${Math.round(acc)}m)`
                      : null,
                  loading: false,
                };
              });
            } else if (err) {
              // Jika putus sinyal sesaat, jangan hapus koordinat yang sudah ada
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

    // Pembersihan saat komponen ditutup
    return () => {
      isMounted = false;
      if (watchIdRef.current != null) {
        Geolocation.clearWatch({ id: watchIdRef.current });
      }
    };
  }, [refreshLocation]);

  return { ...location, refreshLocation };
};
