import { query, satu, sisipkan, transaksi, sekarang } from "../../db.js";
import { Galat, kirim, tidakDitemukan, halaman, denganHalaman } from "../../umum/respons.js";
import { punyaIzin } from "../../umum/izin.js";
import { catatAuditPusat } from "../audit.js";
import { konflik, tanpaCakupan } from "./bersama.js";

export const pengguna = (req) => req.author.username;
export const catat = async (k, req, aksi, entitasUuid = null, { periodeUuid = null, alasan = null, sebelum = null, sesudah = null } = {}) => {
  await sisipkan("hr_gaji_riwayat_tindakan", { faskes_uuid: req.author.faskesUuid, periode_uuid: periodeUuid, entitas_uuid: entitasUuid, aksi, pengguna: pengguna(req), waktu: sekarang(), alasan, hash_sebelum: sebelum, hash_sesudah: sesudah }, k);
  await catatAuditPusat(k, { faskesUuid: req.author.faskesUuid, aksi: aksi.startsWith("baca") ? "baca" : "ubah", entitas: "penggajian", entitasUuid, pengguna: pengguna(req), ringkasan: { aksi, periode_uuid: periodeUuid, hash: sesudah }, layanan: "penunjang-service/hr/penggajian" });
};
export const izin = (...syarat) => async (req, res, next) => {
  try {
    tanpaCakupan(req);
    for (const [sub, aksi] of syarat) if (await punyaIzin(req, "HR / SDM", sub, aksi)) return next();
    await transaksi((k) => catat(k, req, "akses_ditolak"));
    throw new Galat(403, "Anda tidak memiliki izin penggajian untuk tindakan ini");
  } catch (e) { next(e); }
};
export const tangani = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
export const galat = (e, req, res, next) => {
  const status = e.code === "23505" ? 409 : Number(e.status) || 500;
  res.status(status).json({ message: status >= 500 ? "Proses penggajian gagal; hubungi pengelola" : e.code === "23505" ? "Data atau masa pengolahan sudah digunakan" : e.message, payload: null });
};
// Nama tabel hanya berasal dari konstanta di kode, bukan masukan API.
export const ambil = async (k, f, tabel, uuid, kunci = false) => {
  const r = await satu(`SELECT * FROM ${tabel} WHERE faskes_uuid = $1 AND uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, [f, uuid], k);
  if (!r) throw tidakDitemukan("Data penggajian");
  return r;
};
export const draf = (p) => { if (p.status !== "draf" || p.terkunci_pada) throw konflik("Periode hanya dapat diubah saat draf"); };
export const pegawai = async (k, f, uuid) => {
  const r = await satu(`SELECT h.uuid, h.pegawai_uuid, h.tanggal_mulai FROM hr_kepegawaian h JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL AND p.status = true WHERE h.uuid = $1 AND h.faskes_uuid = $2 AND h.deleted_at IS NULL`, [uuid, f], k);
  if (!r) throw tidakDitemukan("Pegawai SDM tertaut");
  return r;
};
export const daftar = async (k, req, tabel, kondisi = "", nilai = [], kolom = "*") => {
  const p = halaman({ ...req.query, limit: Math.min(Number(req.query.limit) || 20, 200) });
  const params = [req.author.faskesUuid, ...nilai];
  const where = `faskes_uuid = $1 AND deleted_at IS NULL ${kondisi}`;
  const total = await satu(`SELECT count(*) AS jumlah FROM ${tabel} WHERE ${where}`, params, k);
  const rows = await query(`SELECT ${kolom} FROM ${tabel} WHERE ${where} ORDER BY created_at DESC, uuid LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, p.limit, p.offset], k);
  return denganHalaman(rows, total.jumlah, p);
};
export const baca = (fn) => tangani(async (req, res) => {
  const hasil = await transaksi(async (k) => {
    const data = await fn(k, req);
    await catat(k, req, "baca_penggajian", req.params.uuid ?? null, { periodeUuid: req.params.uuid ?? null });
    return data;
  });
  kirim(res, hasil);
});
