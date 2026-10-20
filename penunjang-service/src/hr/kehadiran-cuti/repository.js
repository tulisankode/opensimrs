import { query, satu, sisipkan, ubah, sekarang } from "../../db.js";
import { Galat, tidakDitemukan } from "../../umum/respons.js";
import { hitungHashBaris, samarkanRingkasan } from "../../../../packages/model-sdk/umum/audit-core.js";
import { uuidv7 } from "../../db.js";
import { tanggalWib } from "./aturan.js";

export const aktifSql = `h.deleted_at IS NULL AND h.tanggal_selesai IS NULL AND h.status_kepegawaian <> 'purna_tugas'
  AND h.tanggal_mulai <= extract(epoch FROM now()) AND p.deleted_at IS NULL AND p.status = true
  AND (h.unit_uuid IS NULL OR EXISTS (SELECT 1 FROM lokasi l WHERE l.uuid = h.unit_uuid AND l.faskes_uuid = h.faskes_uuid AND l.deleted_at IS NULL))`;
export const pegawai = async (uuid, f, k) => {
  const r = await satu(`SELECT h.*, p.name AS nama FROM hr_kepegawaian h JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid
    WHERE h.uuid = $1 AND h.faskes_uuid = $2 AND ${aktifSql}`, [uuid, f], k);
  if (!r) throw tidakDitemukan("Pegawai aktif tertaut");
  return r;
};
export const milikSaya = async (req, k) => {
  const f = req.author.faskesUuid;
  const r = await satu(`SELECT a.kepegawaian_uuid FROM hr_akun_pegawai a WHERE a.faskes_uuid = $1 AND lower(a.username) = lower($2) AND a.deleted_at IS NULL`, [f, req.author.username], k);
  if (!r) throw tidakDitemukan("Tautan akun pegawai");
  return pegawai(r.kepegawaian_uuid, f, k);
};
export const kunciPegawai = async (uuid, f, k) => {
  await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cuti:${f}:${uuid}`]);
  return pegawai(uuid, f, k);
};
export const dalamCakupan = async (req, h, aksi, k) => {
  const r = await satu(`SELECT 1 FROM hr_cakupan_unit WHERE faskes_uuid = $1 AND lower(username) = lower($2) AND unit_uuid = $3 AND aksi = $4 AND deleted_at IS NULL`,
    [req.author.faskesUuid, req.author.username, h.unit_uuid, aksi], k);
  if (!r) throw new Galat(403, "Pegawai berada di luar cakupan unit yang ditugaskan");
};
export const daftarPegawai = (req, aksi, k) => query(`SELECT h.uuid, h.pegawai_uuid, h.unit_uuid, p.name AS nama,
  (SELECT name FROM lokasi l WHERE l.uuid = h.unit_uuid AND l.faskes_uuid = h.faskes_uuid AND l.deleted_at IS NULL) AS nama_unit FROM hr_kepegawaian h
  JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid
  WHERE h.faskes_uuid = $1 AND ${aktifSql} AND EXISTS (SELECT 1 FROM hr_cakupan_unit c WHERE c.faskes_uuid = h.faskes_uuid
    AND lower(c.username) = lower($2) AND c.unit_uuid = h.unit_uuid AND c.aksi = $3 AND c.deleted_at IS NULL) ORDER BY p.name`,
  [req.author.faskesUuid, req.author.username, aksi], k);
export const ambil = async (tabel, uuid, f, k, kunci = false) => {
  const r = await satu(`SELECT * FROM ${tabel} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, [uuid, f], k);
  if (!r) throw tidakDitemukan();
  return r;
};
export const buat = (tabel, req, data, k) => sisipkan(tabel, { ...data, faskes_uuid: req.author.faskesUuid, dibuat_oleh: req.author.username }, k);
export const perbarui = (tabel, req, r, data, k) => ubah(tabel, r.uuid, req.author.faskesUuid, data, k);
export const cekVersi = (r, versi) => {
  if (Number(r.versi) !== Number(versi)) throw new Galat(409, "Versi data berubah; muat ulang data terbaru");
};
export const bolehDetail = async (req, p, k, bolehSdm = false) => {
  const h = await pegawai(p.kepegawaian_uuid, req.author.faskesUuid, k);
  if (p.pemohon === req.author.username) return h;
  const atasan = await satu(`SELECT 1 FROM hr_akun_pegawai a JOIN hr_kepegawaian h ON h.uuid = a.kepegawaian_uuid AND h.faskes_uuid = a.faskes_uuid
    JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid
    WHERE a.faskes_uuid = $1 AND a.kepegawaian_uuid = $2 AND lower(a.username) = lower($3) AND a.deleted_at IS NULL AND ${aktifSql}`,
    [req.author.faskesUuid, p.atasan_uuid, req.author.username], k);
  if (atasan) return h;
  if (bolehSdm) { await dalamCakupan(req, h, "sahkan_sdm", k); return h; }
  throw tidakDitemukan();
};
export const catatKehadiran = async (req, b, k) => {
  const r = await satu(`INSERT INTO hr_kehadiran (uuid, faskes_uuid, kepegawaian_uuid, waktu, tanggal_operasional, jenis, sumber,
    kode_mesin, catatan_lokasi, kunci_deduplikasi, impor_uuid, dibuat_oleh, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
    ON CONFLICT (faskes_uuid, kunci_deduplikasi) DO NOTHING RETURNING *`,
    [uuidv7(), req.author.faskesUuid, b.kepegawaian_uuid, b.waktu, tanggalWib(b.waktu), b.jenis, b.sumber,
      b.kode_mesin ?? null, b.catatan_lokasi ?? null, b.kunci_deduplikasi, b.impor_uuid ?? null, req.author.username, sekarang()], k);
  return r;
};

// Audit wajib berada dalam transaksi bisnis yang sama. Kegagalan penulisan harus membatalkan keputusan dan saldo.
export const audit = async (req, entitas, uuid, ringkasan, k) => {
  const f = req.author.faskesUuid;
  await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`audit:${f}`]);
  const lama = await satu("SELECT hash_baris FROM audit_trail WHERE faskes_uuid = $1 ORDER BY id DESC LIMIT 1", [f], k);
  const baris = { uuid: uuidv7(), faskes_uuid: f, waktu_epoch: sekarang(), pengguna_uuid: null, identitas_akun: req.author.username,
    peran: null, layanan: "penunjang-service/hr", aksi: "ubah", entitas, entitas_uuid: uuid, patient_uuid: null,
    ringkasan_perubahan: samarkanRingkasan(ringkasan), alamat_ip: null, user_agent: null, request_id: null, hash_sebelumnya: lama?.hash_baris ?? null };
  baris.hash_baris = hitungHashBaris(baris);
  await k.query(`INSERT INTO audit_trail (uuid, faskes_uuid, waktu_epoch, pengguna_uuid, identitas_akun, peran, layanan, aksi,
    entitas, entitas_uuid, patient_uuid, ringkasan_perubahan, alamat_ip, user_agent, request_id, hash_sebelumnya, hash_baris, created_at)
    VALUES ($1,$2,$3,NULL,$4,NULL,$5,$6,$7,$8,NULL,$9,NULL,NULL,NULL,$10,$11,$3)`,
    [baris.uuid, f, baris.waktu_epoch, baris.identitas_akun, baris.layanan, baris.aksi, entitas, uuid, JSON.stringify(baris.ringkasan_perubahan), baris.hash_sebelumnya, baris.hash_baris]);
};
