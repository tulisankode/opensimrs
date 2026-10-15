import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Fisioterapi / Rehabilitasi Medik.

// Jam terapi statis (PRD): slot 1..6, masing-masing 2 jam.
export const JAM_SLOT = [
  { slot: 1, mulai: "08:00", selesai: "10:00" },
  { slot: 2, mulai: "10:00", selesai: "12:00" },
  { slot: 3, mulai: "12:00", selesai: "14:00" },
  { slot: 4, mulai: "14:00", selesai: "16:00" },
  { slot: 5, mulai: "16:00", selesai: "18:00" },
  { slot: 6, mulai: "18:00", selesai: "20:00" },
].map((j) => ({ ...j, label: `${j.mulai.replace(":", ".")} - ${j.selesai.replace(":", ".")}` }));

export const JENIS_FISIO = ["sport", "saraf", "orto", "anak", "geriatri"];
export const FASE_REHAB = ["1", "2a", "2b", "3a", "3b", "4", "5"];

// Zona waktu untuk mengubah epoch (created_at dsb.) menjadi tanggal lokal.
export const TZ = "Asia/Jakarta";
export const tglLokal = (kolom) => `(to_timestamp(${kolom}) AT TIME ZONE '${TZ}')::date`;

export const tanggalValid = (t, nama = "tanggal") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t ?? "")) || Number.isNaN(Date.parse(t))) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return t;
};
export const slotValid = (s) => {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 6) throw permintaanSalah("jam_slot harus 1 sampai 6");
  return n;
};
export const jenisValid = (j) => {
  if (!JENIS_FISIO.includes(j)) throw permintaanSalah(`jenis_fisio harus salah satu: ${JENIS_FISIO.join(", ")}`);
  return j;
};

// Hari ini (tanggal lokal) YYYY-MM-DD.
export const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// Pelanggaran unique index → pesan ramah (409). Galat lain diteruskan.
export const ramah = (e, pesan) => {
  if (e?.code === "23505") throw new Galat(409, pesan);
  throw e;
};

// Rentang tanggal dari query (?tanggal_mulai=&tanggal_selesai=) dengan bawaan hari ini.
export const rentang = (q) => {
  const mulai = q.tanggal_mulai || q.mulai || q.tanggal || hariIni();
  const selesai = q.tanggal_selesai || q.selesai || q.tanggal || mulai;
  return { mulai: tanggalValid(mulai, "tanggal_mulai"), selesai: tanggalValid(selesai, "tanggal_selesai") };
};

export const angka = (v) => (v === null || v === undefined ? v : Number(v));
