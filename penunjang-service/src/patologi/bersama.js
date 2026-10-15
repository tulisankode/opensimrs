import { satu } from "../db.js";

// Konstanta & helper bersama modul Patologi Anatomi.
// Helper tanggal/SQL generik dipakai bersama dengan modul Radiologi.
export { NAMA_PRAKTISI, TZ, daftarNilai, hariIni, ramah, rentangOpsional, tanggalValid, tglLokal } from "../radiologi/bersama.js";

// Jenis pemeriksaan PA → label & prefiks nomor PA (sama dengan CHECK constraint pa_pemeriksaan.jenis).
export const JENIS = {
  histopatologi: { label: "Histopatologi", prefiks: "PA" },
  sitologi: { label: "Sitologi", prefiks: "SIT" },
  potong_beku: { label: "Potong Beku (Frozen Section)", prefiks: "FS" },
  ihk: { label: "Imunohistokimia (IHK)", prefiks: "IHK" },
};
export const STATUS_ORDER = ["order", "valid", "diproses", "selesai", "ditolak", "batal"];
export const STATUS_ITEM = ["menunggu", "diterima", "diproses", "verifikasi", "selesai", "ditolak"];
export const SUMBER = ["rme", "aps", "rujukan"];
export const FIKSASI = { formalin_10: "Formalin buffer 10%", alkohol_95: "Alkohol 95%", tanpa_fiksasi: "Tanpa fiksasi (segar)", lainnya: "Lainnya" };
export const KEPERLUAN_PINJAM = { konsultasi: "Konsultasi", second_opinion: "Second opinion", ihk_luar: "Pemeriksaan IHK/molekuler luar", pendidikan: "Pendidikan/penelitian", lainnya: "Lainnya" };

export const HARI = 86400;

// Nomor PA tahunan per jenis, mis. PA-26-00001 / SIT-26-00001 / FS-26-00001 / IHK-26-00001.
// Penghitung disimpan di penunjang_nomor (prefiks 'NOPA-<prefiks>', tanggal = tahun) sehingga aman dari tabrakan.
export const nomorPa = async (faskesUuid, jenis, k) => {
  const prefiks = JENIS[jenis]?.prefiks ?? "PA";
  const tahun = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(new Date());
  const r = await satu(
    `INSERT INTO penunjang_nomor (faskes_uuid, prefiks, tanggal, terakhir) VALUES ($1, $2, $3, 1)
     ON CONFLICT (faskes_uuid, prefiks, tanggal) DO UPDATE SET terakhir = penunjang_nomor.terakhir + 1
     RETURNING terakhir`,
    [faskesUuid, `NOPA-${prefiks}`, tahun],
    k,
  );
  return `${prefiks}-${tahun.slice(2)}-${String(r.terakhir).padStart(5, "0")}`;
};

// Teks opsional dari body: undefined = tidak diubah, kosong = null.
export const teks = (v, maks = 0) => {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s ? (maks ? s.slice(0, maks) : s) : null;
};

// Epoch detik dari angka/ISO; undefined bila tidak dikirim, null bila kosong.
export const epoch = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return Math.floor(n > 1e12 ? n / 1000 : n);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
};

// Kode ICD-O: topografi C00.0–C80.9, morfologi 4 digit/perilaku (mis. 8500/3). Kosong = null.
export const icdoTopografi = (v) => {
  const s = teks(v, 20);
  if (s === undefined || s === null) return s;
  if (!/^C\d{2}(\.\d)?$/i.test(s)) throw Object.assign(new Error("Kode ICD-O topografi harus berformat Cxx.x (mis. C50.9)"), { status: 400 });
  return s.toUpperCase();
};
export const icdoMorfologi = (v) => {
  const s = teks(v, 20);
  if (s === undefined || s === null) return s;
  if (!/^\d{4}\/[0-369]$/.test(s)) throw Object.assign(new Error("Kode ICD-O morfologi harus berformat 9999/9 (mis. 8500/3)"), { status: 400 });
  return s;
};
