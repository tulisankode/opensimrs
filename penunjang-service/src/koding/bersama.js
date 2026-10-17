// Konstanta & helper bersama modul Koding Rekam Medis.
export { daftarNilai, ramah, rentangOpsional, tanggalValid, tglLokal, TZ, hariIni } from "../radiologi/bersama.js";

export const KUNJUNGAN_TIPE = ["rj", "ri", "igd"];
export const TABEL_KUNJUNGAN = { rj: "rawat_jalans", ri: "rawat_inaps", igd: "instalasi_gawat_darurats" };
export const STATUS_KODING = ["proses", "siap_klaim"];
export const STATUS_CHECKLIST = ["lengkap", "tidak_lengkap", "tidak_berlaku"];
export const STATUS_KLARIFIKASI = ["menunggu", "terjawab", "ditutup"];
export const KEPUTUSAN_RETENSI = ["disetujui", "ditolak", "ditunda"];

// Target waktu koding rawat inap (PRD T2): 2 × 24 jam setelah pasien pulang.
export const TARGET_KODING_DETIK = 2 * 24 * 60 * 60;

// UNION ALL kolom yang sama dari ketiga tabel kunjungan sumber (RJ/RI/IGD), dipakai laporan & rekap lintas jenis.
export const unionKunjungan = (kolom) =>
  KUNJUNGAN_TIPE.map((t) => `SELECT '${t}' AS kunjungan_tipe, ${kolom} FROM ${TABEL_KUNJUNGAN[t]} WHERE deleted_at IS NULL`).join(" UNION ALL ");

export const teks = (v, maks = 0) => {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s ? (maks ? s.slice(0, maks) : s) : null;
};

// Epoch detik dari angka/ISO/"YYYY-MM-DD"; undefined bila tidak dikirim, null bila kosong/tidak valid.
export const epoch = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return Math.floor(n > 1e12 ? n / 1000 : n);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
};
