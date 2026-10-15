// Impor Excel rombongan MCU: templat unduhan (tata letak unggah massal adamLIS + kolom karyawan), pembacaan file
// HRD apa adanya, dan laporan baris gagal. Validasi & pemetaan dilakukan di backend (penunjang-service /mcu/impor).
// Dropdown Excel (data validation) & named range ditulis langsung ke XML karena SheetJS edisi komunitas tidak
// mendukungnya; berkas zip diolah dengan CFB bawaan SheetJS.
import * as XLSX from "xlsx-js-style";

// 20 kolom format adamLIS (A–T) + kolom opsional karyawan (U–X).
export const KOLOM_PASIEN = [
  "no_registrasi", "nama", "jenis_kelamin", "jenis_identitas", "no_identitas", "tgl_lahir", "no_rm", "jenis_pasien", "no_telp",
  "alamat", "provinsi", "kabupaten", "kecamatan", "unit_asal", "dokter_pengirim", "penjamin", "diagnosa_awal", "icdt",
  "paket_pemeriksaans", "non_paket_pemeriksaans", "nik_karyawan", "jabatan", "bagian", "tanggal_mcu",
];
const MAKS_BARIS = 1000;

const kol = (i: number) => XLSX.utils.encode_col(i);
const namaRange = (awalan: string, s: string) => `${awalan}${String(s).replace(/[^A-Za-z0-9]/g, "_")}`;
const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const kolomSheet = (judul: string, nilai: string[]) => XLSX.utils.aoa_to_sheet(nilai.length ? nilai.map((v) => [v]) : [["-"]]);
const tebal = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0E7C86" } }, alignment: { vertical: "center" } };

export type ReferensiImpor = {
  paket: { kode: string; nama: string; harga: number; jenis: string }[];
  unitAsal: string[];
  dokter: string[];
  penjamin: string[];
  tambahan: { jenis: string; kode: string; nama: string; harga: number }[];
  wilayah: { provinsi: { code: string; nama: string }[]; kabupaten: { code: string; prov: string; nama: string }[]; kecamatan: { code: string; kab: string; nama: string }[] };
  icd?: string[];
};

// ── Templat ──────────────────────────────────────────────────────────────────
export function unduhTemplatImporMcu(ref: ReferensiImpor, namaFaskes = "") {
  const wb = XLSX.utils.book_new();
  const names: { Name: string; Ref: string }[] = [];
  const sudah = new Set<string>();
  const tambahNama = (Name: string, Ref: string) => {
    if (sudah.has(Name.toLowerCase())) return;
    sudah.add(Name.toLowerCase());
    names.push({ Name, Ref });
  };

  // Pasien: header + baris kosong berformat teks untuk kolom nomor (NIK tidak berubah jadi angka 15 digit).
  const aoa: any[][] = [KOLOM_PASIEN.map((h) => ({ v: h, t: "s", s: tebal }))];
  const kolomTeks = new Set(["no_registrasi", "no_identitas", "no_rm", "no_telp", "nik_karyawan"]);
  for (let r = 0; r < MAKS_BARIS; r++) aoa.push(KOLOM_PASIEN.map((h) => (kolomTeks.has(h) ? { v: "", t: "s", s: { numFmt: "@" } } : null)));
  const wsPasien = XLSX.utils.aoa_to_sheet(aoa);
  wsPasien["!cols"] = KOLOM_PASIEN.map((h) => ({ wch: ["nama", "alamat", "diagnosa_awal", "icdt", "dokter_pengirim"].includes(h) ? 28 : 18 }));
  wsPasien["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsPasien, "Pasien");

  // Petunjuk.
  const petunjuk = [
    ["PETUNJUK PENGISIAN — Impor Peserta MCU Rombongan" + (namaFaskes ? ` (${namaFaskes})` : "")],
    [""],
    ["Isi sheet Pasien mulai baris 2, satu baris per karyawan. Perusahaan, tanggal MCU bawaan & paket bawaan dipilih di dialog impor OpenSIMRS."],
    ["Format adamLIS (kolom A–T) diterima apa adanya; kolom U–X (nik_karyawan, jabatan, bagian, tanggal_mcu) opsional."],
    [""],
    ["Kolom", "Wajib", "Keterangan"],
    ["no_registrasi", "Tidak", "Nomor referensi dari HRD/LIS; tidak boleh ganda dalam satu file."],
    ["nama", "Ya", "Nama lengkap sesuai KTP."],
    ["jenis_kelamin", "Ya*", "Laki-laki / Perempuan (L/P juga diterima). *Wajib untuk pasien baru."],
    ["jenis_identitas", "Tidak", "KTP (bawaan), PASPOR, LAIN-LAIN."],
    ["no_identitas", "Ya", "NIK 16 digit untuk KTP. Kunci pencocokan pasien lama. Ketik sebagai teks (kolom sudah berformat teks)."],
    ["tgl_lahir", "Ya*", "dd/mm/yyyy, yyyy-mm-dd, atau tanggal Excel. *Wajib untuk pasien baru."],
    ["no_rm", "Tidak", "Bila diisi, pasien lama dicocokkan lewat No. RM lebih dulu."],
    ["jenis_pasien", "Tidak", "Reguler / Cito (Cito menandai order lab & radiologi CITO)."],
    ["no_telp", "Tidak", "Nomor HP."],
    ["alamat, provinsi, kabupaten, kecamatan", "Tidak", "Dipakai untuk pasien baru; wilayah dicocokkan ke master wilayah OpenSIMRS (pilih dari dropdown)."],
    ["unit_asal, dokter_pengirim, penjamin", "Tidak", "Dicocokkan ke master faskes berdasarkan nama; tidak ditemukan = peringatan."],
    ["diagnosa_awal, icdt", "Tidak", "Catatan klinis & ICD-10 (kode atau nama, '-' bila kosong)."],
    ["paket_pemeriksaans", "Tidak", "Kode/nama paket MCU (lihat sheet Paket_MCU). Kosong = paket bawaan dialog. Satu paket per peserta."],
    ["non_paket_pemeriksaans", "Tidak", "Pemeriksaan tambahan di luar paket (kode/nama di sheet Pemeriksaan_tambahan), pisahkan dengan koma. Ditagihkan terpisah."],
    ["tanggal_mcu", "Tidak", "Tanggal MCU per baris; kosong = tanggal di dialog impor."],
    [""],
    ["Contoh baris:"],
    ["HRD-001", "Budi Santoso", "Laki-laki", "KTP", "9999010101010003", "12/03/1985", "", "Reguler", "080000000000", "Jl. Raya Industri 18",
      "Jawa Timur", "Kota Surabaya", "Gubeng", "", "", "", "", "-", ref.paket[0]?.kode ?? "", "", "K-0001", "Operator Gudang", "Logistik", ""],
  ];
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
  wsPetunjuk["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, "Petunjuk");

  // Paket MCU & pemeriksaan tambahan.
  const wsPaket = XLSX.utils.aoa_to_sheet([["kode", "nama", "harga"], ...ref.paket.map((p) => [p.kode, p.nama, p.harga])]);
  wsPaket["!cols"] = [{ wch: 14 }, { wch: 40 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsPaket, "Paket_MCU");
  tambahNama("Paket", `Paket_MCU!$A$2:$A$${Math.max(ref.paket.length + 1, 2)}`);
  const wsTambahan = XLSX.utils.aoa_to_sheet([["jenis", "kode", "nama", "harga"], ...ref.tambahan.map((t) => [t.jenis, t.kode, t.nama, t.harga])]);
  wsTambahan["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsTambahan, "Pemeriksaan_tambahan");

  // Referensi satu kolom (nama sheet sama dengan file adamLIS).
  const satuKolom: [string, string[], string][] = [
    ["Unit_asal", ref.unitAsal, "Unit_asal"],
    ["Dokter_pengirim", ref.dokter, "Dokter_pengirim"],
    ["Penjamin", ref.penjamin, "Penjamin"],
    ["Icdt", ["-", ...(ref.icd ?? [])], "Icdt"],
  ];
  for (const [sheet, nilai, nama] of satuKolom) {
    XLSX.utils.book_append_sheet(wb, kolomSheet(sheet, nilai), sheet);
    tambahNama(`Daftar_${nama}`, `${sheet}!$A$1:$A$${Math.max(nilai.length, 1) + (sheet === "Icdt" ? 0 : 0)}`);
  }

  // Wilayah: baris 1 = provinsi, di bawahnya kabupaten/kota provinsi tsb; sheet Kecamatan: kolom per kabupaten.
  const prov = ref.wilayah.provinsi;
  const kabPerProv = prov.map((p) => ref.wilayah.kabupaten.filter((k) => k.prov === p.code));
  const tinggi = Math.max(...kabPerProv.map((k) => k.length), 1);
  const wilayahAoa: any[][] = [prov.map((p) => p.nama)];
  for (let r = 0; r < tinggi; r++) wilayahAoa.push(kabPerProv.map((k) => k[r]?.nama ?? null));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wilayahAoa), "Wilayah");
  tambahNama("Provinsi", `Wilayah!$A$1:$${kol(prov.length - 1)}$1`);
  prov.forEach((p, i) => {
    const n = kabPerProv[i].length;
    if (n) tambahNama(namaRange("P_", p.nama), `Wilayah!$${kol(i)}$2:$${kol(i)}$${n + 1}`);
  });
  const kab = ref.wilayah.kabupaten;
  const kecPerKab = kab.map((k) => ref.wilayah.kecamatan.filter((c) => c.kab === k.code).map((c) => c.nama));
  const tinggiKec = Math.max(...kecPerKab.map((k) => k.length), 1);
  const kecAoa: any[][] = [kab.map((k) => k.nama)];
  for (let r = 0; r < tinggiKec; r++) kecAoa.push(kecPerKab.map((k) => k[r] ?? null));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kecAoa), "Kecamatan");
  kab.forEach((k, i) => {
    const n = kecPerKab[i].length;
    if (n) tambahNama(namaRange("K_", k.nama), `Kecamatan!$${kol(i)}$2:$${kol(i)}$${n + 1}`);
  });
  wb.Workbook = { Names: names } as any;

  // Dropdown (data validation) pada sheet Pasien; gaya peringatan agar nilai di luar daftar tetap boleh diketik.
  const akhir = MAKS_BARIS + 1;
  const c = (nama: string) => kol(KOLOM_PASIEN.indexOf(nama));
  const dv = (kolom: string, rumus: string) =>
    `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="warning" sqref="${kolom}2:${kolom}${akhir}"><formula1>${xmlEsc(rumus)}</formula1></dataValidation>`;
  const daftarDv = [
    dv(c("jenis_kelamin"), '"Laki-laki,Perempuan"'),
    dv(c("jenis_identitas"), '"KTP,PASPOR,LAIN-LAIN"'),
    dv(c("jenis_pasien"), '"Reguler,Cito"'),
    dv(c("provinsi"), "Provinsi"),
    dv(c("kabupaten"), `INDIRECT("P_"&SUBSTITUTE(SUBSTITUTE(${c("provinsi")}2," ","_"),".","_"))`),
    dv(c("kecamatan"), `INDIRECT("K_"&SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${c("kabupaten")}2," ","_"),".","_"),"-","_"))`),
    dv(c("unit_asal"), "Daftar_Unit_asal"),
    dv(c("dokter_pengirim"), "Daftar_Dokter_pengirim"),
    dv(c("penjamin"), "Daftar_Penjamin"),
    dv(c("icdt"), "Daftar_Icdt"),
    dv(c("paket_pemeriksaans"), "Paket"),
  ];
  const data = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const cfb = (XLSX as any).CFB.read(new Uint8Array(data), { type: "array" });
  const entri = (path: string) => cfb.FileIndex[cfb.FullPaths.indexOf(`Root Entry/${path}`)];
  const sheet1 = entri("xl/worksheets/sheet1.xml");
  let xml = new TextDecoder().decode(sheet1.content);
  const sisip = `<dataValidations count="${daftarDv.length}">${daftarDv.join("")}</dataValidations>`;
  xml = xml.includes("</mergeCells>") ? xml.replace("</mergeCells>", `</mergeCells>${sisip}`) : xml.replace("</sheetData>", `</sheetData>${sisip}`);
  sheet1.content = new TextEncoder().encode(xml);
  const keluar = (XLSX as any).CFB.write(cfb, { fileType: "zip", type: "array", compression: true });
  const blob = new Blob([keluar], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Templat Impor Peserta MCU.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ── Baca file HRD ────────────────────────────────────────────────────────────
const normKunci = (s: any) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const kosong = (v: any) => v === null || v === undefined || String(v).trim() === "";

export type FileImpor = { namaFile: string; sheet: string; header: any[]; baris: any[][]; nomorBaris: number[] };

// Sheet "Pasien" (format adamLIS / templat OpenSIMRS) bila ada, selain itu sheet pertama yang memuat kolom nama.
// Baris header = baris pertama (dari 10 teratas) yang memuat kolom nama; baris kosong dilewati.
export async function bacaFileImporMcu(file: File): Promise<FileImpor> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false, cellNF: false });
  const urutan = [...wb.SheetNames.filter((n) => normKunci(n) === "pasien"), ...wb.SheetNames.filter((n) => normKunci(n) !== "pasien")];
  for (const sheet of urutan) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: "", blankrows: true });
    const idx = rows.slice(0, 10).findIndex((r) => r.some((c) => ["nama", "namalengkap", "namapasien", "namapeserta", "namakaryawan"].includes(normKunci(c))));
    if (idx < 0) continue;
    const header = rows[idx];
    const baris: any[][] = [];
    const nomorBaris: number[] = [];
    rows.slice(idx + 1).forEach((r, i) => {
      if (!r.some((c) => !kosong(c))) return;
      baris.push(header.map((_, j) => (r[j] === undefined ? "" : r[j])));
      nomorBaris.push(idx + i + 2);
    });
    return { namaFile: file.name, sheet, header, baris, nomorBaris };
  }
  throw new Error("Kolom 'nama' tidak ditemukan. Gunakan templat impor MCU atau format unggah massal (sheet Pasien).");
}

// Laporan baris gagal: baris asli + kolom keterangan galat, siap diperbaiki & diunggah ulang.
export function unduhBarisGagal(file: FileImpor, gagal: { no: number; alasan?: string; galat?: string[] }[], namaPerusahaan = "") {
  const peta = new Map(file.nomorBaris.map((n, i) => [n, file.baris[i]]));
  const aoa = [
    [...file.header, "keterangan_galat", "baris_asal"],
    ...gagal.map((g) => [...(peta.get(g.no) ?? file.header.map(() => "")), g.alasan ?? (g.galat ?? []).join("; "), g.no]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [...file.header.map(() => ({ wch: 16 })), { wch: 80 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pasien");
  XLSX.writeFile(wb, `Baris gagal impor MCU${namaPerusahaan ? " - " + namaPerusahaan : ""}.xlsx`);
}
