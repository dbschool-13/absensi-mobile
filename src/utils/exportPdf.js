import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportToPDF = (rekapData, schoolName, monthLabel, year) => {
  // Tetap menggunakan orientasi portrait ('p') dengan penyesuaian padding dan lebar sel 
  // agar 11 kolom masuk dengan rapi.
  const doc = new jsPDF("p", "mm", "a4");

  // Header PDF
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text(`Laporan Rekapitulasi Absensi Bulanan`, 14, 20);

  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(`Instansi: ${schoolName || "Sekolah"}`, 14, 28);
  doc.text(`Periode : ${monthLabel} ${year}`, 14, 34);

  // Definisi Header Tabel PDF (Ditambah Kolom Kehadiran)
  const tableColumn = [
    "No",
    "Nama Pegawai & NIP",
    "H", // Hadir
    "I", // Izin
    "S", // Sakit
    "C", // Cuti
    "A", // Alpa
    "Total Jam",
    "Kekurangan",
    "Kehadiran", // BARU: Metrik Kehadiran Fisik
    "Jam Kerja",   // Metrik Pemenuhan Jam
  ];

  const tableRows = [];

  // Looping data yang dilempar dari AdminRekap.jsx
  rekapData.forEach((data, index) => {
    tableRows.push([
      index + 1,
      `${data.nama}\nNIP: ${data.nip}`,
      data.hadir,
      data.izin,
      data.sakit,
      data.cuti,
      data.alpa,
      `${data.totalJamKerja} Jam`,
      data.teksKekurangan,
      `${data.persentaseKehadiran}%`, // Injeksi Persentase Kehadiran
      `${data.persentase}%`,          // Persentase Kinerja
    ]);
  });

  // Konfigurasi autoTable
  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    theme: "grid",
    headStyles: {
      fillColor: [79, 70, 229], // Warna Indigo (menyesuaikan tema aplikasi)
      halign: "center",
      valign: "middle",
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8, // Diperkecil sedikit agar 11 kolom muat dengan elegan
      valign: "middle",
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },  // No
      1: { cellWidth: 54 },                   // Nama & NIP
      2: { halign: "center", cellWidth: 9 },  // H
      3: { halign: "center", cellWidth: 9 },  // I
      4: { halign: "center", cellWidth: 9 },  // S
      5: { halign: "center", cellWidth: 9 },  // C
      6: { halign: "center", cellWidth: 9 },  // A
      7: { halign: "center", cellWidth: 18 }, // Total Jam
      8: { halign: "center", cellWidth: 24 }, // Kekurangan
      9: { halign: "center", cellWidth: 18 }, // Kehadiran
      10: { halign: "center", cellWidth: 18 },// Kinerja
    },
  });

  // Keterangan Legenda di bawah tabel
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text("Keterangan:", 14, finalY);
  doc.setFont(undefined, "normal");
  doc.text(
    "H = Hadir    I = Izin Pribadi / Kedinasan    S = Sakit    C = Cuti    A = Alpa (Tanpa Keterangan)",
    14,
    finalY + 6,
  );

  // ==========================================
  // BLOK TANDA TANGAN (Kanan Bawah)
  // ==========================================
  const ttdY = finalY + 20; // Jarak vertikal dari legenda
  const ttdX = 135; // Posisi X di sebelah kanan (Kertas A4 lebarnya 210mm)

  // Mengambil tanggal hari ini dan format ke Bahasa Indonesia
  const today = new Date();
  const monthsIndo = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const tglStr = `${String(today.getDate()).padStart(2, "0")} ${monthsIndo[today.getMonth()]} ${today.getFullYear()}`;

  // Render teks tanda tangan rata kiri pada kordinat ttdX
  doc.text(`Makassar, ${tglStr}`, ttdX, ttdY);
  doc.text("Kepala Sekolah", ttdX, ttdY + 6);
  
  // Ruang kosong untuk tanda tangan basah (sekitar 24 satuan)
  doc.setFont(undefined, "bold");
  doc.text("Muhammad Kasim, S.Pd., M.Pd", ttdX, ttdY + 30);
  doc.setFont(undefined, "normal");
  doc.text("NIP. 19720319 199903 1 002", ttdX, ttdY + 35);

  // Proses Download
  doc.save(`Rekap_Absen_${schoolName || "Sekolah"}_${monthLabel}_${year}.pdf`);
};