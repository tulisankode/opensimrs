import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Radiologi.

// Modalitas (kode DICOM ringkas) — sama dengan CHECK constraint rad_pemeriksaan.modalitas.
export const MODALITAS = {
  XR: "Radiografi (X-Ray)",
  DX: "Radiografi Digital",
  US: "USG",
  CT: "CT Scan",
  MR: "MRI",
  FL: "Fluoroskopi",
  MG: "Mammografi",
  LAIN: "Lainnya",
};
export const STATUS_ORDER = ["order", "valid", "diperiksa", "selesai", "batal"];
export const STATUS_ITEM = ["menunggu", "diperiksa", "selesai"];
export const SUMBER = ["rme", "aps", "mcu"];

export const TZ = "Asia/Jakarta";
export const tglLokal = (kolom) => `(to_timestamp(${kolom}) AT TIME ZONE '${TZ}')::date`;
export const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const tanggalValid = (t, nama = "tanggal") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t ?? "")) || Number.isNaN(Date.parse(t))) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return t;
};

// Rentang tanggal dari query (?tanggal_mulai=&tanggal_selesai=); kosong = tanpa filter (null).
export const rentangOpsional = (q) => {
  const mulai = q.tanggal_mulai || q.tanggal || null;
  const selesai = q.tanggal_selesai || q.tanggal || mulai;
  if (!mulai) return null;
  return { mulai: tanggalValid(mulai, "tanggal_mulai"), selesai: tanggalValid(selesai, "tanggal_selesai") };
};

// Pelanggaran unique index → pesan ramah (409). Galat lain diteruskan.
export const ramah = (e, pesan) => {
  if (e?.code === "23505") throw new Galat(409, pesan);
  throw e;
};

export const daftarNilai = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// Nama praktisi (dokter) sebagai ekspresi SQL dari alias practitioner+pegawai via subkueri.
export const NAMA_PRAKTISI = (kolom) =>
  `(SELECT TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, '')))
      FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = ${kolom})`;

// ── Ruang & penjadwalan ──────────────────────────────────────────────────────

// Hari operasional: 1 = Senin … 7 = Minggu (ISO, sama dengan EXTRACT(ISODOW)).
export const HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export const STATUS_JADWAL = ["terjadwal", "hadir", "diperiksa", "batal"];

// "HH:MM" / "HH:MM:SS" → menit sejak 00:00; galat 400 bila format salah.
export const keMenit = (jam, nama = "jam") => {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(jam ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw permintaanSalah(`${nama} harus berformat HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
};
export const dariMenit = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

// Hari ISO (1..7) dari tanggal YYYY-MM-DD.
export const hariIso = (tanggal) => {
  const d = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

// Jam sekarang (menit) zona Asia/Jakarta.
export const menitSekarang = () => {
  const [j, m] = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":");
  return (Number(j) % 24) * 60 + Number(m);
};

// Daftar slot (menit mulai) ruang pada satu hari: dari jam_buka, kelipatan durasi_slot, selesai ≤ jam_tutup.
export const slotRuang = (r) => {
  const buka = keMenit(r.jam_buka);
  const tutup = keMenit(r.jam_tutup);
  const d = Number(r.durasi_slot) || 15;
  const hasil = [];
  for (let t = buka; t + d <= tutup; t += d) hasil.push(t);
  return hasil;
};
