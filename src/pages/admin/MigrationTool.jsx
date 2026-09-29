// import React, { useState } from "react";
// import { db } from "../../services/firebase";
// import { collection, getDocs, doc, setDoc } from "firebase/firestore";

// export default function MigrationTool() {
//   const [status, setStatus] = useState("Standby");
//   const [isMigrating, setIsMigrating] = useState(false);

//   const runMigration = async () => {
//     const isConfirm = window.confirm(
//       "PERHATIAN: Jalankan Migrasi Data ke Sub-Koleksi? Pastikan koneksi internet stabil.",
//     );
//     if (!isConfirm) return;

//     setIsMigrating(true);
//     setStatus("Memulai Migrasi... Jangan tutup halaman ini.");

//     try {
//       // 1. MIGRASI DATA PEGAWAI (USERS)
//       setStatus("Tahap 1/3: Menyalin data Pegawai (Users)...");
//       const usersSnap = await getDocs(collection(db, "users"));
//       let userCount = 0;
//       for (const userDoc of usersSnap.docs) {
//         const data = userDoc.data();
//         if (data.school_id) {
//           // Format Baru: schools/{school_id}/users/{user_id}
//           const newRef = doc(db, `schools/${data.school_id}/users`, userDoc.id);
//           await setDoc(newRef, data);
//           userCount++;
//         }
//       }

//       // 2. MIGRASI DATA ABSENSI (ATTENDANCES)
//       setStatus(
//         `Tahap 2/3: Menyalin ${userCount} Pegawai Selesai. Memulai migrasi Absensi...`,
//       );
//       const attSnap = await getDocs(collection(db, "attendances"));
//       let attCount = 0;
//       for (const attDoc of attSnap.docs) {
//         const data = attDoc.data();
//         if (data.school_id) {
//           // Format Baru: schools/{school_id}/attendances/{att_id}
//           const newRef = doc(
//             db,
//             `schools/${data.school_id}/attendances`,
//             attDoc.id,
//           );
//           await setDoc(newRef, data);
//           attCount++;
//         }
//       }

//       // 3. MIGRASI DATA PENGAJUAN IZIN (LEAVE REQUESTS)
//       setStatus(
//         `Tahap 3/3: Menyalin ${attCount} Absensi Selesai. Memulai migrasi Izin...`,
//       );
//       const leaveSnap = await getDocs(collection(db, "leave_requests"));
//       let leaveCount = 0;
//       for (const leaveDoc of leaveSnap.docs) {
//         const data = leaveDoc.data();
//         if (data.school_id) {
//           // Format Baru: schools/{school_id}/leave_requests/{leave_id}
//           const newRef = doc(
//             db,
//             `schools/${data.school_id}/leave_requests`,
//             leaveDoc.id,
//           );
//           await setDoc(newRef, data);
//           leaveCount++;
//         }
//       }

//       setStatus(
//         `✅ MIGRASI SELESAI! Berhasil menyalin: ${userCount} Pegawai, ${attCount} Absen, dan ${leaveCount} Izin.`,
//       );
//     } catch (error) {
//       console.error(error);
//       setStatus("❌ Error saat migrasi: " + error.message);
//     } finally {
//       setIsMigrating(false);
//     }
//   };

//   return (
//     <div className="p-6 bg-yellow-50 border border-yellow-400 rounded-2xl m-4 shadow-sm">
//       <h3 className="font-black text-red-600 text-lg mb-1">
//         Alat Migrasi Sub-Koleksi (Tahap 3)
//       </h3>
//       <p className="text-sm text-gray-700 mb-4 font-medium">
//         Tombol ini akan menyalin seluruh data dari Root Database ke dalam
//         "Kamar" Sekolah masing-masing.
//       </p>

//       <div className="bg-white p-3 rounded-xl border border-gray-200 mb-4">
//         <p className="text-sm font-bold text-gray-600">Status Proses:</p>
//         <p
//           className={`text-sm mt-1 font-semibold ${
//             status.includes("Error")
//               ? "text-red-500"
//               : status.includes("SELESAI")
//               ? "text-emerald-600"
//               : "text-blue-600"
//           }`}
//         >
//           {status}
//         </p>
//       </div>

//       <button
//         onClick={runMigration}
//         disabled={isMigrating}
//         className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-all ${
//           isMigrating
//             ? "bg-gray-400 cursor-not-allowed"
//             : "bg-red-600 hover:bg-red-700 active:scale-95"
//         }`}
//       >
//         {isMigrating ? "Proses Berjalan..." : "Mulai Migrasi Data Sekarang"}
//       </button>
//     </div>
//   );
// }
