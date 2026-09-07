import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportToPDF = (rekapData, schoolName, monthLabel, year) => {
  // Menggunakan orientasi landscape ('l') jika dirasa kolom terlalu padat,
  // namun untuk 10 kolom ini, portrait ('p') default masih sangat muat dan rapi.
  const doc = new jsPDF("p", "mm", "a4");

  // Header PDF
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text(`Laporan Rekapitulasi Absensi Bulanan`, 14, 20);

  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(`Instansi: ${schoolName || "Sekolah"}`, 14, 28);
  doc.text(`Periode : ${monthLabel} ${year}`, 14, 34);

  // Definisi Header Tabel PDF (Sesuai Standar Dinas)
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
    "Kinerja",
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
      `${data.persentase}%`,
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
      fontSize: 8, // Diperkecil sedikit agar data muat dengan elegan
      valign: "middle",
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 }, // No
      1: { cellWidth: 60 }, // Nama & NIP
      2: { halign: "center", cellWidth: 10 }, // H
      3: { halign: "center", cellWidth: 10 }, // I
      4: { halign: "center", cellWidth: 10 }, // S
      5: { halign: "center", cellWidth: 10 }, // C
      6: { halign: "center", cellWidth: 10 }, // A
      7: { halign: "center", cellWidth: 20 }, // Total Jam
      8: { halign: "center", cellWidth: 25 }, // Kekurangan
      9: { halign: "center", cellWidth: 20 }, // Kinerja (Persentase)
    },
  });

  // Keterangan Legenda di bawah tabel
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text("Keterangan:", 14, finalY);
  doc.setFont(undefined, "normal");
  doc.text(
    "H = Hadir     I = Izin Pribadi / Kedinasan     S = Sakit     C = Cuti     A = Alpa (Tanpa Keterangan)",
    14,
    finalY + 6,
  );

  // Proses Download
  doc.save(`Rekap_Absen_${schoolName || "Sekolah"}_${monthLabel}_${year}.pdf`);
};
