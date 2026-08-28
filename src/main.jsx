import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext.jsx";

// TAMBAHKAN 2 BARIS INI UNTUK KAMERA PWA
import { defineCustomElements } from "@ionic/pwa-elements/loader";
defineCustomElements(window);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
