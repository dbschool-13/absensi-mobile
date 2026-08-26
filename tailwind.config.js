/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5", // Indigo 600
        primary_dark: "#4338CA",
        secondary: "#10B981", // Emerald 500 (Untuk status sukses/hadir)
        danger: "#EF4444", // Red 500 (Untuk absen luar area/telat)
        background: "#F3F4F6", // Gray 100
        surface: "#FFFFFF",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"], // Pastikan font modern
      },
      boxShadow: {
        premium:
          "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
        glass: "0 4px 30px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [],
};
