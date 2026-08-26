import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Absensi Sekolah",
        short_name: "Absensi",
        description: "Aplikasi Kehadiran Guru & Pegawai",
        theme_color: "#6366f1",
        background_color: "#F4F6F9",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      // 👇 TAMBAHKAN BLOK WORKBOX INI 👇
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000, // Menaikkan limit menjadi 5 MB
      },
    }),
  ],
});
