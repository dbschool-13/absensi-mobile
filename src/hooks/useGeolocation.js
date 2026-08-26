import { useState, useEffect, useCallback } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export const useGeolocation = () => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  // Fungsi untuk Memaksa Refresh Lokasi (Bisa dipanggil dari tombol)
  const refreshLocation = useCallback(async () => {
    setLocation((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await Geolocation.requestPermissions();
        if (permission.location !== "granted") {
          setLocation((prev) => ({
            ...prev,
            error: "Izin lokasi ditolak",
            loading: false,
          }));
          return;
        }
      }

      // Ambil posisi SEKALI SAJA dengan paksaan akurasi tinggi dan TANPA CACHE
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // 0 = Paksa ambil dari satelit langsung, bukan history HP
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        error: null,
        loading: false,
      });
    } catch (error) {
      setLocation((prev) => ({
        ...prev,
        error: error.message,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    let watchId = null;

    const startWatching = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const permission = await Geolocation.requestPermissions();
          if (permission.location !== "granted") {
            setLocation((prev) => ({
              ...prev,
              error: "Izin lokasi ditolak",
              loading: false,
            }));
            return;
          }
        }

        // Panggil refresh pertama kali buka aplikasi
        refreshLocation();

        // Pantau pergerakan dengan setting yang lebih agresif
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          (position, err) => {
            if (position) {
              setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                error: null,
                loading: false,
              });
            } else if (err) {
              setLocation((prev) => ({
                ...prev,
                error: err.message,
                loading: false,
              }));
            }
          },
        );
      } catch (error) {
        setLocation((prev) => ({
          ...prev,
          error: error.message,
          loading: false,
        }));
      }
    };

    startWatching();

    return () => {
      if (watchId != null) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [refreshLocation]);

  return { ...location, refreshLocation };
};
