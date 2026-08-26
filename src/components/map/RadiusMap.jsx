import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix icon bawaan leaflet di React
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Komponen untuk auto-center kamera ke lokasi user
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center[0] && center[1]) {
      map.flyTo(center, 17, { animate: true });
    }
  }, [center, map]);
  return null;
};

export default function RadiusMap({
  userLat,
  userLon,
  schoolLat,
  schoolLon,
  radius,
}) {
  if (!schoolLat || !schoolLon)
    return <div className="h-48 bg-gray-200 animate-pulse rounded-2xl"></div>;

  const schoolPos = [schoolLat, schoolLon];
  const userPos = userLat && userLon ? [userLat, userLon] : schoolPos;

  return (
    <div className="h-64 w-full rounded-2xl overflow-hidden shadow-premium z-0 relative">
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
          radius={radius}
        />

        {/* Marker Lokasi User */}
        {userLat && userLon && <Marker position={userPos} />}

        <MapUpdater center={userPos} />
      </MapContainer>
    </div>
  );
}
