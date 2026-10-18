import config from "../config.js";
import { query, satu, sekarang, uuidv7 } from "../db.js";
import { tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { validasiBerkas } from "./bersama.js";

// Berkas bukti (foto kerusakan & sertifikat kalibrasi) disimpan BYTEA di PostgreSQL dan hanya dapat diambil lewat rute
// API berizin "Berkas" › READ (KF-16) — tidak ada URL statis. Unggahan dikirim JSON { nama_berkas, tipe_mime,
// data_base64 }; tipe (PDF/JPG/PNG) diperiksa dari isi & ukuran dibatasi MAX_UPLOAD_BERKAS_SARPRAS_MB (KT-19).
export const MAKS_BERKAS_PER_INDUK = 10;

const KOLOM_INDUK = { foto_kerusakan: "laporan_uuid", sertifikat_kalibrasi: "kalibrasi_uuid" };

export const simpanBerkas = async (k, { faskesUuid, jenis, indukUuid, body, pengguna }) => {
  const berkas = validasiBerkas(body, config.berkasSarprasMaksMb);
  const kolom = KOLOM_INDUK[jenis];
  const jumlah = Number((await satu(`SELECT COUNT(*) n FROM sarpras_berkas WHERE ${kolom} = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [indukUuid, faskesUuid], k)).n);
  if (jumlah >= MAKS_BERKAS_PER_INDUK) throw permintaanSalah(`Maksimal ${MAKS_BERKAS_PER_INDUK} berkas per data`);
  // INSERT langsung (bukan sisipkan()): sisipkan menyimpan objek sebagai JSON, sedangkan isi berkas harus Buffer → BYTEA.
  const n = sekarang();
  return satu(
    `INSERT INTO sarpras_berkas (uuid, faskes_uuid, jenis_berkas, ${kolom}, nama_berkas, tipe_mime, ukuran_bita, data, diunggah_oleh, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING uuid, jenis_berkas, ${kolom}, nama_berkas, tipe_mime, ukuran_bita, diunggah_oleh, created_at`,
    [uuidv7(), faskesUuid, jenis, indukUuid, berkas.nama_berkas, berkas.tipe_mime, berkas.ukuran_bita, berkas.data, pengguna, n],
    k,
  );
};

// Metadata saja (tanpa isi) untuk ditampilkan di detail.
export const daftarBerkas = (jenis, indukUuid, faskesUuid, k) =>
  query(
    `SELECT uuid, jenis_berkas, nama_berkas, tipe_mime, ukuran_bita, diunggah_oleh, created_at FROM sarpras_berkas
      WHERE ${KOLOM_INDUK[jenis]} = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`,
    [indukUuid, faskesUuid],
    k,
  );

export const ambilBerkas = async (jenis, indukUuid, berkasUuid, faskesUuid) => {
  const b = await satu(
    `SELECT uuid, nama_berkas, tipe_mime, ukuran_bita, data FROM sarpras_berkas
      WHERE uuid = $1 AND ${KOLOM_INDUK[jenis]} = $2 AND faskes_uuid = $3 AND deleted_at IS NULL`,
    [String(berkasUuid), String(indukUuid), faskesUuid],
  );
  if (!b) throw tidakDitemukan("Berkas");
  return { uuid: b.uuid, nama_berkas: b.nama_berkas, tipe_mime: b.tipe_mime, ukuran_bita: b.ukuran_bita, data_base64: b.data.toString("base64") };
};
