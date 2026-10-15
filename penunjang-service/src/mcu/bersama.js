import { satu } from "../db.js";
import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Medical Check Up (MCU).

// Stasiun pemeriksaan MCU (urutan alur peserta). Paket hanya memakai sebagian; "kesimpulan" selalu ada.
export const STASIUN = [
  { kode: "anamnesis", nama: "Anamnesis & Riwayat" },
  { kode: "tanda_vital", nama: "Tanda Vital & Antropometri" },
  { kode: "fisik", nama: "Pemeriksaan Fisik" },
  { kode: "visus", nama: "Visus & Buta Warna" },
  { kode: "audiometri", nama: "Audiometri" },
  { kode: "laboratorium", nama: "Laboratorium" },
  { kode: "radiologi", nama: "Radiologi" },
  { kode: "ekg", nama: "EKG" },
  { kode: "spirometri", nama: "Spirometri" },
  { kode: "gigi", nama: "Pemeriksaan Gigi" },
  { kode: "kesimpulan", nama: "Kesimpulan Dokter" },
];
export const KODE_STASIUN = STASIUN.map((s) => s.kode);
export const namaStasiun = (kode) => STASIUN.find((s) => s.kode === kode)?.nama ?? kode;

export const JENIS_ITEM = ["lab", "radiologi", "tindakan"];
export const JENIS_PAKET = ["perorangan", "korporasi", "semua"];
export const JENIS_MCU = ["umum", "pra_kerja", "berkala", "khusus", "purna_kerja"];
export const KESIMPULAN = ["fit", "fit_catatan", "unfit"];
export const LABEL_KESIMPULAN = { fit: "Fit (Layak Bekerja)", fit_catatan: "Fit dengan Catatan", unfit: "Unfit (Tidak Layak)" };

// Susun daftar stasiun paket: hanya kode dikenal, tanpa duplikat, urut alur baku; stasiun laboratorium /
// radiologi ditambahkan bila paket berisi item jenis tsb, dan kesimpulan selalu di akhir.
export const susunStasiun = (stasiun = [], items = []) => {
  if (!Array.isArray(stasiun)) throw permintaanSalah("stasiun harus berupa array");
  const tidakDikenal = stasiun.filter((s) => !KODE_STASIUN.includes(s));
  if (tidakDikenal.length) throw permintaanSalah(`Stasiun tidak dikenal: ${tidakDikenal.join(", ")}`);
  const set = new Set([...stasiun, "kesimpulan"]);
  if (items.some((i) => i.jenis === "lab")) set.add("laboratorium");
  if (items.some((i) => i.jenis === "radiologi")) set.add("radiologi");
  return KODE_STASIUN.filter((k) => set.has(k));
};

export const TZ = "Asia/Jakarta";
export const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const tanggalValid = (t, nama = "tanggal") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t ?? "")) || Number.isNaN(Date.parse(t))) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return t;
};

// Rentang tanggal dari query (?tanggal_mulai=&tanggal_selesai=); bawaan hari ini.
export const rentang = (q, bawaanMulai) => {
  const mulai = q.tanggal_mulai || q.tanggal || bawaanMulai || hariIni();
  const selesai = q.tanggal_selesai || q.tanggal || hariIni();
  return { mulai: tanggalValid(mulai, "tanggal_mulai"), selesai: tanggalValid(selesai, "tanggal_selesai") };
};

// Pelanggaran unique index → 409 dengan pesan ramah.
export const ramah = (e, pesan) => {
  if (e?.code === "23505") throw new Galat(409, pesan);
  throw e;
};

export const angka = (v) => (v === null || v === undefined ? v : Number(v));
export const konflik = (pesan) => new Galat(409, pesan);

// Nama dokter (practitioner) lengkap dengan gelar — dipakai di SELECT sebagai subkueri.
export const SQL_NAMA_DOKTER = (kolom) => `(SELECT TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, '')))
    FROM practitioner dk JOIN pegawai pg ON pg.uuid = dk.pegawai_uuid WHERE dk.uuid = ${kolom})`;

// Harga kontrak perusahaan untuk paket pada tanggal MCU (aktif & dalam masa berlaku). null = pakai harga paket.
export const hargaKontrak = (perusahaanUuid, paketUuid, tanggal, k) =>
  !perusahaanUuid
    ? null
    : satu(
        `SELECT uuid, harga::float8 AS harga, no_kontrak, berlaku_mulai::text AS berlaku_mulai, berlaku_sampai::text AS berlaku_sampai
           FROM mcu_harga_kontrak
          WHERE perusahaan_uuid = $1 AND paket_uuid = $2 AND status AND deleted_at IS NULL
            AND (berlaku_mulai IS NULL OR berlaku_mulai <= $3::date) AND (berlaku_sampai IS NULL OR berlaku_sampai >= $3::date)
          ORDER BY berlaku_mulai DESC NULLS LAST, created_at DESC LIMIT 1`,
        [perusahaanUuid, paketUuid, tanggal],
        k,
      );
