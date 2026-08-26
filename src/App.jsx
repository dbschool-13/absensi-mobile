import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Layouts
import MobileLayout from "./components/layout/MobileLayout";
import AdminLayout from "./components/layout/AdminLayout";

// Auth Pages
import Login from "./pages/auth/Login";

// Mobile Pages (Guru)
import Dashboard from "./pages/mobile/Dashboard";
import Riwayat from "./pages/mobile/Riwayat";
import KepsekMonitoring from "./pages/mobile/KepsekMonitoring";
import Profil from "./pages/mobile/Profil";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRekap from "./pages/admin/AdminRekap";
import AdminGuru from "./pages/admin/AdminGuru";
import AdminSetting from "./pages/admin/AdminSetting";
import AdminMonitoring from "./pages/admin/AdminMonitoring";

import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

// ==========================================
// CUSTOM ROUTE PROTECTORS
// ==========================================
const GuruRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Jika admin login tapi mencoba akses url mobile, lempar ke admin
  if (user.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Jika guru login tapi mencoba akses url admin, lempar ke dashboard mobile
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function AppRoutes() {
  const { user } = useAuth();

  useEffect(() => {
    // Sembunyikan Splash Screen native Android saat React sudah sukses memuat
    if (Capacitor.isNativePlatform()) {
      setTimeout(() => {
        SplashScreen.hide();
      }, 1000); // Tahan logo splash screen selama 1 detik
    }
  }, []);

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{ duration: 3000, className: "rounded-2xl shadow-xl" }}
      />
      <Routes>
        {/* Route Login */}
        <Route
          path="/login"
          element={
            user ? (
              user.role === "admin" ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Login />
            )
          }
        />

        {/* ======================================= */}
        {/* APLIKASI MOBILE (Khusus Guru/Karyawan & Kepsek) */}
        {/* ======================================= */}
        <Route
          element={
            <GuruRoute>
              <MobileLayout />
            </GuruRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/riwayat" element={<Riwayat />} />
          <Route path="/profil" element={<Profil />} />
          {/* Tambahkan rute pantau untuk kepsek */}
          <Route path="/pantau" element={<KepsekMonitoring />} />
        </Route>

        {/* ======================================= */}
        {/* WEB ADMIN PANEL (Khusus Administrator)  */}
        {/* ======================================= */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="pantau" element={<AdminMonitoring />} />
          <Route path="rekap" element={<AdminRekap />} />
          <Route path="guru" element={<AdminGuru />} />
          <Route path="setting" element={<AdminSetting />} />{" "}
          {/* <--- TAMBAHKAN INI */}
        </Route>

        {/* Redirect Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
