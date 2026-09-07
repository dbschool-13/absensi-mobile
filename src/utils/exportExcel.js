import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Helper untuk membaca waktu dari Firebase Timestamp ATAU ISO String (Suntikan Izin)
const getValidTime = (timeData) => {
  if (!timeData) return null;
  if (typeof timeData.toDate === "function") {
    return timeData.toDate(); // Kembalikan objek Date asli
  }
  return new Date(timeData); // Konversi string ISO ke objek Date
};

export const exportToExcel = async (
  rekapMingguan,
  weekDates,
  schoolName,
  weekLabel,
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Rekap Mingguan");

  // 1. Setup Kolom Dasar
  // Lebar kolom
  worksheet.getColumn(1).width = 5; // No
  worksheet.getColumn(2).width = 25; // Nama

  let colIndex = 3;
  weekDates.forEach(() => {
    worksheet.getColumn(colIndex).width = 12; // Jam Datang
    worksheet.getColumn(colIndex + 1).width = 12; // Jam Pulang
    colIndex += 2;
  });

  worksheet.getColumn(colIndex).width = 15; // Total Jam
  worksheet.getColumn(colIndex + 1).width = 15; // Kekurangan Jam

  // 2. Buat Header Row 1 (Hari)
  const row1 = worksheet.getRow(1);
  row1.getCell(1).value = "No.";
  row1.getCell(2).value = "Nama";

  let currentCell = 3;
  weekDates.forEach((date) => {
    row1.getCell(currentCell).value = format(date, "EEEE", { locale: id });
    worksheet.mergeCells(1, currentCell, 1, currentCell + 1);
    currentCell += 2;
  });
  row1.getCell(currentCell).value = "Total Jam\nMinggu Ini";
  row1.getCell(currentCell + 1).value = "Kekurangan\nJam";

  // 3. Buat Header Row 2 (Tanggal)
  const row2 = worksheet.getRow(2);
  currentCell = 3;
  weekDates.forEach((date) => {
    row2.getCell(currentCell).value = format(date, "dd MMMM yyyy", {
      locale: id,
    });
    worksheet.mergeCells(2, currentCell, 2, currentCell + 1);
    currentCell += 2;
  });

  // 4. Buat Header Row 3 (Jam Datang & Pulang)
  const row3 = worksheet.getRow(3);
  currentCell = 3;
  weekDates.forEach(() => {
    row3.getCell(currentCell).value = "Jam Datang";
    row3.getCell(currentCell + 1).value = "Jam Pulang";
    currentCell += 2;
  });

  // Merge untuk No, Nama, Total, Kekurangan agar tergabung ke bawah (Row 1-3)
  worksheet.mergeCells("A1:A3"); // No
  worksheet.mergeCells("B1:B3"); // Nama
  worksheet.mergeCells(1, currentCell, 3, currentCell); // Total Jam
  worksheet.mergeCells(1, currentCell + 1, 3, currentCell + 1); // Kekurangan Jam

  // Style Header (Tengah, Bold, Border)
  for (let i = 1; i <= 3; i++) {
    worksheet.getRow(i).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  // 5. Isi Data Pegawai
  let rowIndex = 4;
  rekapMingguan.forEach((data, index) => {
    const row = worksheet.getRow(rowIndex);

    // Info Dasar
    const noCell = row.getCell(1);
    noCell.value = index + 1;
    noCell.alignment = { vertical: "middle", horizontal: "center" };

    const namaCell = row.getCell(2);
    namaCell.value = `${data.nama}\n${data.nip}`;
    namaCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };

    let cIndex = 3;
    let totalJamKerja = 0;

    // Data Per Hari (Senin - Jumat)
    weekDates.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const absenHariIni = data.absensiHarian.find((a) => a.date === dateStr);

      const cellDatang = row.getCell(cIndex);
      const cellPulang = row.getCell(cIndex + 1);

      cellDatang.alignment = { vertical: "middle", horizontal: "center" };
      cellPulang.alignment = { vertical: "middle", horizontal: "center" };

      // Default font merah untuk kosong (strip) jika belum absen
      cellDatang.font = { color: { argb: "FFFF0000" }, bold: true };
      cellPulang.font = { color: { argb: "FFFF0000" }, bold: true };
      cellDatang.value = "-";
      cellPulang.value = "-";

      if (absenHariIni) {
        // =========================================================
        // LOGIKA BARU: BACA STATUS DARI NOTES
        // =========================================================
        const note = (absenHariIni.notes || "").toUpperCase();
        const isAutoInject = note.includes("[AUTO-INJECT");

        if (isAutoInject) {
          // JIKA IZIN/SAKIT/CUTI
          let leaveLabel = absenHariIni.status.toUpperCase();
          const match = note.match(/\[AUTO-INJECT:\s(.*?)\]/);
          if (match) leaveLabel = match[1];

          // Merge sel jam datang & pulang untuk menuliskan nama Izinnya di tengah
          worksheet.mergeCells(rowIndex, cIndex, rowIndex, cIndex + 1);

          cellDatang.value = leaveLabel;
          cellDatang.font = { color: { argb: "FFFFA500" }, bold: true }; // Warna Oranye

          // cellPulang tidak perlu diisi karena sudah di-merge ke cellDatang
        } else {
          // JIKA HADIR NORMAL DI SEKOLAH
          const isTargetMet =
            absenHariIni.status === "Memenuhi Target" ||
            absenHariIni.total_hours >= 8;
          const colorArg = isTargetMet ? "FF008000" : "FFFF0000"; // Hijau jika tuntas, Merah jika kurang

          cellDatang.font = { color: { argb: colorArg }, bold: true };
          cellPulang.font = { color: { argb: colorArg }, bold: true };

          if (absenHariIni.check_in?.time) {
            const jamMasukValid = getValidTime(absenHariIni.check_in.time);
            if (jamMasukValid) {
              cellDatang.value = format(jamMasukValid, "HH:mm");
            }
          }

          if (absenHariIni.check_out?.time) {
            const jamPulangValid = getValidTime(absenHariIni.check_out.time);
            if (jamPulangValid) {
              cellPulang.value = format(jamPulangValid, "HH:mm");
            }
          }
        }

        totalJamKerja += absenHariIni.total_hours || 0;
      }

      cIndex += 2;
    });

    // Total Jam & Kekurangan Jam
    const targetJamSeminggu = weekDates.length * 8;
    const kekurangan = targetJamSeminggu - totalJamKerja;

    const totalCell = row.getCell(cIndex);
    totalCell.value = parseFloat(totalJamKerja.toFixed(1));
    totalCell.alignment = { vertical: "middle", horizontal: "center" };
    totalCell.font = { bold: true };

    const kurangCell = row.getCell(cIndex + 1);
    kurangCell.value = kekurangan > 0 ? parseFloat(kekurangan.toFixed(1)) : 0;
    kurangCell.alignment = { vertical: "middle", horizontal: "center" };
    kurangCell.font = { color: { argb: "FFFF0000" }, bold: true };

    // Terapkan border ke seluruh baris
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    rowIndex++;
  });

  // Export File
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Rekap_Mingguan_${schoolName}_${weekLabel}.xlsx`);
};
