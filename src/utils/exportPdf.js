import jsPDF from "jspdf";
// PERUBAHAN 1: Import autoTable sebagai fungsi, bukan sekadar memanggil modul
import autoTable from "jspdf-autotable";

export const exportToPDF = (rekapData, schoolName, monthLabel, year) => {
  const doc = new jsPDF();

  // Header PDF
  doc.setFontSize(16);
  doc.text(`Laporan Rekapitulasi Absensi`, 14, 20);
  doc.setFontSize(11);
  doc.text(`Instansi: ${schoolName || "Sekolah"}`, 14, 28);
  doc.text(`Periode: ${monthLabel} ${year}`, 14, 34);

  // Tabel PDF
  const tableColumn = [
    "No",
    "NIP",
    "Nama Guru",
    "Hadir",
    "Tidak Hadir",
    "Total Jam",
    "Persentase",
  ];
  const tableRows = [];

  rekapData.forEach((data, index) => {
    tableRows.push([
      index + 1,
      data.nip,
      data.nama,
      data.totalHadir,
      data.totalTidakHadir,
      data.totalJamKerja,
      `${data.persentase}%`,
    ]);
  });

  // PERUBAHAN 2: Gunakan fungsi autoTable secara langsung dan masukkan 'doc' sebagai argumen pertama
  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    theme: "grid",
    headStyles: { fillColor: [79, 70, 229] },
  });

  doc.save(`Rekap_Absen_${schoolName || "Sekolah"}_${monthLabel}_${year}.pdf`);
};
