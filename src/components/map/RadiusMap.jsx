import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix icon bawaan leaflet di React (Vite)
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Komponen Ganda: Auto-center kamera + Penyembuh Blank Abu-abu
const MapUpdater = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    // Beri jeda 100ms agar pop-up selesai merender, lalu paksa peta menyesuaikan ukuran
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (center[0] && center[1]) {
        map.flyTo(center, 17, { animate: true }); // Terbang ke lokasi user
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [center, map]);

  return null;
};

export default function RadiusMap({
  userLat,
  userLng, // DIPERBAIKI: Sebelumnya userLon
  schoolLat,
  schoolLng, // DIPERBAIKI: Sebelumnya schoolLon
  radius,
}) {
  if (!schoolLat || !schoolLng)
    return (
      <div className="h-full w-full bg-gray-200 animate-pulse rounded-2xl"></div>
    );

  const schoolPos = [schoolLat, schoolLng];
  const userPos = userLat && userLng ? [userLat, userLng] : schoolPos;

  return (
    // Bungkusan <div> yang bertabrakan dihilangkan, langsung me-return MapContainer
    <MapContainer
      center={schoolPos}
      zoom={17}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
      />

      {/* Lingkaran Radius Sekolah */}
      <Circle
        center={schoolPos}
        pathOptions={{
          color: "#4F46E5",
          fillColor: "#4F46E5",
          fillOpacity: 0.2,
        }}
        radius={Number(radius) || 60}
      />

      {/* Marker Lokasi User */}
      {userLat && userLng && <Marker position={userPos} />}

      <MapUpdater center={userPos} />
    </MapContainer>
  );
}
