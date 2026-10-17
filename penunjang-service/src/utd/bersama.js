import { permintaanSalah } from "../umum/respons.js";
// Helper tanggal/pesan ramah sama dengan Radiologi/Mikrobiologi.
export { daftarNilai, hariIni, ramah, rentangOpsional, tanggalValid, tglLokal } from "../radiologi/bersama.js";

// Konstanta & helper bersama modul UTD / UPTD Produksi Darah.

export const GOLONGAN_DARAH = { A: "A", B: "B", AB: "AB", O: "O" };
export const RHESUS = { positif: "Rhesus Positif (+)", negatif: "Rhesus Negatif (-)" };
export const JENIS_KELAMIN = { L: "Laki-laki", P: "Perempuan" };
export const STATUS_AKTIF_DONOR = { aktif: "Aktif", ditahan: "Ditahan" };
export const STATUS_SELEKSI = { proses: "Dalam Proses", layak: "Layak", tunda: "Tunda", tolak: "Tolak" };
export const REAKSI_DONOR = { tidak_ada: "Tidak ada reaksi", ringan: "Reaksi ringan", sedang: "Reaksi sedang", berat: "Reaksi berat" };
export const STATUS_KANTONG = { karantina: "Karantina", karantina_reaktif: "Karantina/Reaktif", tersedia: "Tersedia", dimusnahkan: "Dimusnahkan" };
export const PARAMETER_IMLTD = { hiv: "HIV", hbsag: "HBsAg", hcv: "HCV", sifilis: "Sifilis" };
export const HASIL_IMLTD = { reaktif: "Reaktif", non_reaktif: "Non-Reaktif" };
export const STATUS_AKHIR_IMLTD = { pending: "Menunggu Hasil", non_reaktif: "Non-Reaktif", reaktif: "Reaktif" };
export const JENIS_KOMPONEN = { PRC: "Packed Red Cells (PRC)", TC: "Thrombocyte Concentrate (TC)", FFP: "Fresh Frozen Plasma (FFP)", CRYO: "Cryoprecipitate" };
export const STATUS_KOMPONEN = {
  karantina: "Karantina", tersedia: "Tersedia", dialokasikan: "Dialokasikan", didistribusikan: "Didistribusikan",
  dimusnahkan: "Dimusnahkan", kedaluwarsa: "Kedaluwarsa",
};
export const PENERIMA_TIPE = { bdrs_internal: "BDRS Internal", eksternal: "Eksternal (RS/Faskes lain)" };
export const STATUS_PERMINTAAN = { menunggu: "Menunggu", sebagian: "Terpenuhi Sebagian", terpenuhi: "Terpenuhi", ditolak: "Ditolak" };
export const STATUS_DISTRIBUSI = { terkirim: "Terkirim", menunggu_integrasi: "Menunggu Integrasi BDRS", gagal_integrasi: "Integrasi Gagal" };
export const ALASAN_MUSNAH = { reaktif: "Reaktif", kedaluwarsa: "Kedaluwarsa", lain: "Lainnya" };
export const JENIS_LAPORAN = {
  donor: "Donor", produksi: "Produksi", uji_saring: "Uji Saring IMLTD", distribusi: "Distribusi", pemusnahan: "Pemusnahan", bulanan: "Bulanan (Lengkap)",
};

export const pilihan = (obj) => Object.entries(obj).map(([kode, nama]) => ({ kode, nama }));

export const cekPilihan = (nilai, obj, nama) => {
  if (nilai === undefined || nilai === null || nilai === "") return nilai === "" ? null : nilai;
  if (!obj[nilai]) throw permintaanSalah(`${nama} harus salah satu: ${Object.keys(obj).join(", ")}`);
  return nilai;
};

export const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);

export const angkaOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw permintaanSalah(`${nama} harus berupa angka`);
  return n;
};

// "YYYY-MM-DD" wajib (tanggal lahir, tanggal kedaluwarsa); null diperbolehkan bila opsional dicek pemanggil.
export const tanggalOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(v))) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return v;
};

export const waktuOpsional = (v, nama) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw permintaanSalah(`${nama} tidak valid (detik epoch)`);
  return Math.floor(n);
};

// Selisih hari kalender UTC antara dua "YYYY-MM-DD".
export const selisihHari = (dariTgl, keTgl) => Math.round((new Date(`${keTgl}T00:00:00Z`) - new Date(`${dariTgl}T00:00:00Z`)) / 86400000);
