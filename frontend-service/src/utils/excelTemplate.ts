import * as XLSX from "xlsx-js-style";

// Pembantu template import Excel datamaster.

/**
 * Jadikan kolom tertentu berformat Teks ("@") sampai baris tertentu, agar NIK 16 digit
 * tidak berubah menjadi angka/notasi ilmiah dan tanggal DD-MM-YYYY tidak diubah Excel.
 */
export const jadikanKolomTeks = (
  worksheet: XLSX.WorkSheet,
  kolom: number[],
  barisTerakhir = 500
) => {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  for (let row = 1; row <= barisTerakhir; row++) {
    for (const col of kolom) {
      const alamat = XLSX.utils.encode_cell({ r: row, c: col });
      const sel = worksheet[alamat];
      worksheet[alamat] = { t: "s", v: sel ? String(sel.v) : "", z: "@" };
    }
  }
  range.e.r = Math.max(range.e.r, barisTerakhir);
  worksheet["!ref"] = XLSX.utils.encode_range(range);
};

/**
 * Tebalkan dan beri warna baris judul kolom (baris pertama) template.
 */
export const gayaJudulKolom = (worksheet: XLSX.WorkSheet, jumlahKolom: number) => {
  for (let col = 0; col < jumlahKolom; col++) {
    const alamat = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[alamat]) continue;
    worksheet[alamat].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "9fe2db" } },
      alignment: { horizontal: "center", vertical: "center" },
    };
  }
};

/**
 * Sheet "Keterangan" berisi petunjuk pengisian template.
 */
export const sheetKeterangan = (petunjuk: string[]) => {
  const worksheet = XLSX.utils.aoa_to_sheet([["Keterangan"], ...petunjuk.map((p) => [p])]);
  worksheet["A1"].s = { font: { bold: true } };
  worksheet["!cols"] = [{ wch: Math.max(...petunjuk.map((p) => p.length)) + 2 }];
  return worksheet;
};
