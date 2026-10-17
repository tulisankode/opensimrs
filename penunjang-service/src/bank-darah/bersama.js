import { permintaanSalah } from "../umum/respons.js";
// Helper umum (tanggal lokal, rentang, pesan ramah, nama praktisi) sama dengan Radiologi/Mikrobiologi.
export { NAMA_PRAKTISI, daftarNilai, hariIni, ramah, rentangOpsional, tanggalValid, tglLokal } from "../radiologi/bersama.js";

// Konstanta & helper bersama modul Bank Darah RS (BDRS).

export const GOLONGAN_ABO = { A: "A", B: "B", AB: "AB", O: "O" };
export const RHESUS = { positif: "Rhesus Positif (+)", negatif: "Rhesus Negatif (-)" };
// OK (Kamar Operasi) belum punya kunjungan tersendiri di repo (modul kamar_operasi masih "segera").
export const SUMBER_KUNJUNGAN = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD" };

export const STATUS_PERMINTAAN = {
  baru: "Baru",
  diproses: "Diproses BDRS",
  perlu_dilengkapi: "Perlu Dilengkapi",
  dipenuhi_sebagian: "Dipenuhi Sebagian",
  diserahkan: "Diserahkan",
  dibatalkan: "Dibatalkan",
  ditolak: "Ditolak",
};
export const STATUS_PERMINTAAN_AKTIF = ["baru", "diproses", "perlu_dilengkapi", "dipenuhi_sebagian"];

export const HASIL_UJI = { kompatibel: "Kompatibel", inkompatibel: "Inkompatibel" };
export const SKRINING_ANTIBODI = { negatif: "Negatif", positif: "Positif" };

export const STATUS_STOK = {
  tersedia: "Tersedia",
  dialokasikan: "Dialokasikan",
  diserahkan: "Diserahkan",
  kedaluwarsa: "Kedaluwarsa",
  dimusnahkan: "Dimusnahkan",
  dikembalikan: "Dikembalikan",
};
export const SUMBER_STOK = { utd_manual: "UTD (manual)", utd_otomatis: "UTD (otomatis)" };

export const STATUS_SERAH_TERIMA = { menunggu: "Menunggu Konfirmasi", selesai: "Selesai", batal: "Batal" };
export const STATUS_TAGIHAN_ST = { belum: "Belum Dikirim", terkirim: "Terkirim", gagal: "Gagal" };

export const STATUS_TRANSFUSI = { berlangsung: "Berlangsung", selesai_tanpa_reaksi: "Selesai Tanpa Reaksi", reaksi: "Reaksi" };
export const STATUS_TINDAK_LANJUT_REAKSI = { baru: "Baru Dilaporkan", ditindaklanjuti: "Ditindaklanjuti", selesai: "Selesai" };

export const AMBANG_KEDALUWARSA_BAWAAN = 3;

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
