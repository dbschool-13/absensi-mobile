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

// Custom Icon Merah untuk Lokasi Pengguna
const redUserIcon = L.divIcon({
  className: "custom-red-marker",
  html: `
    <div style="
      background-color: #5151f5; 
      width: 20px; 
      height: 20px; 
      border-radius: 50%; 
      border: 2px solid white; 
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Komponen Inisialisasi: Hanya memperbaiki ukuran peta
const MapInitializer = () => {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

export default function RadiusMap({
  userLat,
  userLng,
  schoolLat,
  schoolLng,
  radius,
}) {
  if (!schoolLat || !schoolLng)
    return (
      <div className="h-full w-full bg-gray-200 animate-pulse rounded-2xl"></div>
    );

  const schoolPos = [schoolLat, schoolLng];
  const userPos = userLat && userLng ? [userLat, userLng] : schoolPos;

  return (
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

      {/* Marker Titik Lokasi User (Hanya ini yang tampil) */}
      {userLat && userLng && <Marker position={userPos} icon={redUserIcon} />}

      <MapInitializer />
    </MapContainer>
  );
}