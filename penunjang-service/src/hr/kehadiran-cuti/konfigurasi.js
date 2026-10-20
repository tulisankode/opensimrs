import express from "express";
import { query, satu, sekarang, transaksi } from "../../db.js";
import { kirim, tangani, permintaanSalah } from "../../umum/respons.js";
import { wajibIzin } from "../../umum/izin.js";
import { wajibTeks, boolean, validasiKebijakan } from "./aturan.js";
import { buat, ambil, perbarui, cekVersi, audit, pegawai } from "./repository.js";

const rute = express.Router();
const izin = (aksi) => wajibIzin("HR / SDM", "Kehadiran, Cuti & Izin", aksi);
export const aksiCakupan = ["impor", "koreksi", "sahkan_sdm", "lihat_rekap", "ekspor_rekap", "sesuaikan_saldo"];

rute.get("/jenis-cuti", izin("READ"), tangani(async (req, res) => {
  kirim(res, await query(`SELECT * FROM hr_jenis_cuti WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama`, [req.author.faskesUuid]));
}));
const jenis = (b) => {
  const kode = wajibTeks(b.kode, "Kode", 50);
  if (!/^[a-z][a-z0-9_]*$/.test(kode)) throw permintaanSalah("Kode harus berupa huruf kecil, angka, dan garis bawah");
  return { kode, nama: wajibTeks(b.nama, "Nama", 150), memotong_saldo: boolean(b.memotong_saldo, "memotong_saldo"), lampiran_wajib: boolean(b.lampiran_wajib, "lampiran_wajib"), aktif: boolean(b.aktif, "aktif") };
};
rute.post("/jenis-cuti", izin("ATUR JENIS KEBIJAKAN"), tangani(async (req, res) => {
  const data = jenis(req.body ?? {});
  const hasil = await transaksi(async (k) => {
    const r = await buat("hr_jenis_cuti", req, data, k);
    await audit(req, "hr_jenis_cuti", r.uuid, data, k);
    return r;
  });
  kirim(res, hasil, "Jenis cuti berhasil dicatat");
}));
rute.patch("/jenis-cuti/:uuid", izin("ATUR JENIS KEBIJAKAN"), tangani(async (req, res) => {
  kirim(res, await transaksi(async (k) => {
    const r = await ambil("hr_jenis_cuti", req.params.uuid, req.author.faskesUuid, k, true);
    cekVersi(r, req.body?.versi);
    const data = jenis({ ...r, ...req.body });
    const baru = await perbarui("hr_jenis_cuti", req, r, { ...data, versi: r.versi + 1 }, k);
    await audit(req, "hr_jenis_cuti", r.uuid, { sebelum: r, sesudah: baru }, k);
    return baru;
  }), "Jenis cuti berhasil diperbarui");
}));
rute.delete("/jenis-cuti/:uuid", izin("ATUR JENIS KEBIJAKAN"), tangani(async (req, res) => {
  const alasan = wajibTeks(req.body?.alasan, "Alasan");
  kirim(res, await transaksi(async (k) => {
    const r = await ambil("hr_jenis_cuti", req.params.uuid, req.author.faskesUuid, k, true);
    const hasil = await perbarui("hr_jenis_cuti", req, r, { deleted_at: sekarang(), aktif: false }, k);
    await audit(req, "hr_jenis_cuti", r.uuid, { alasan, deleted_at: hasil.deleted_at }, k);
    return { uuid: r.uuid, deleted_at: hasil.deleted_at };
  }), "Jenis cuti dihapus lunak");
}));
rute.get("/kebijakan", izin("READ"), tangani(async (req, res) => {
  kirim(res, await query(`SELECT * FROM hr_kebijakan_cuti WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY tahun DESC, versi DESC`, [req.author.faskesUuid]));
}));
rute.put("/kebijakan", izin("ATUR JENIS KEBIJAKAN"), tangani(async (req, res) => {
  const data = validasiKebijakan(req.body ?? {});
  kirim(res, await transaksi(async (k) => {
    await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`kebijakan:${req.author.faskesUuid}:${data.tahun}`]);
    const lama = await satu(`SELECT max(versi) AS versi FROM hr_kebijakan_cuti WHERE faskes_uuid = $1 AND tahun = $2 AND deleted_at IS NULL`, [req.author.faskesUuid, data.tahun], k);
    const r = await buat("hr_kebijakan_cuti", req, { tahun: data.tahun, data, versi: Number(lama.versi ?? 0) + 1 }, k);
    await audit(req, "hr_kebijakan_cuti", r.uuid, data, k);
    return r;
  }), "Versi kebijakan berhasil dicatat; saldo yang sudah terbentuk tetap memakai kebijakan asal");
}));
rute.get("/cakupan", izin("ATUR CAKUPAN"), tangani(async (req, res) => {
  const f = req.author.faskesUuid;
  kirim(res, { atasan: await query(`SELECT * FROM hr_atasan_pegawai WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f]),
    unit: await query(`SELECT * FROM hr_cakupan_unit WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f]),
    pegawai: await query(`SELECT h.uuid, p.name AS nama FROM hr_kepegawaian h JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid WHERE h.faskes_uuid = $1 AND h.deleted_at IS NULL AND h.tanggal_selesai IS NULL AND p.deleted_at IS NULL AND p.status = true ORDER BY p.name`, [f]),
    lokasi: await query(`SELECT uuid, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]), aksi: aksiCakupan });
}));
rute.put("/cakupan", izin("ATUR CAKUPAN"), tangani(async (req, res) => {
  const b = req.body ?? {}, f = req.author.faskesUuid;
  const alasan = wajibTeks(b.alasan, "Alasan perubahan");
  kirim(res, await transaksi(async (k) => {
    await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`cakupan:${f}`]);
    let r;
    if (b.kepegawaian_uuid) {
      const h = await pegawai(wajibTeks(b.kepegawaian_uuid, "Pegawai", 255), f, k);
      const atasan = await pegawai(wajibTeks(b.atasan_uuid, "Atasan", 255), f, k);
      if (h.uuid === atasan.uuid) throw permintaanSalah("Pegawai tidak boleh menjadi atasannya sendiri");
      await query(`UPDATE hr_atasan_pegawai SET deleted_at = $1, updated_at = $1 WHERE faskes_uuid = $2 AND kepegawaian_uuid = $3 AND deleted_at IS NULL`, [sekarang(), f, h.uuid], k);
      r = await buat("hr_atasan_pegawai", req, { kepegawaian_uuid: h.uuid, atasan_uuid: atasan.uuid }, k);
    } else {
      const username = wajibTeks(b.username, "Akun", 120), unit = wajibTeks(b.unit_uuid, "Unit", 255);
      if (!aksiCakupan.includes(b.aksi)) throw permintaanSalah("Aksi cakupan tidak sah");
      if (!await satu(`SELECT 1 FROM users WHERE lower(username) = lower($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [username, f], k) ||
          !await satu(`SELECT 1 FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [unit, f], k)) throw permintaanSalah("Akun atau unit tidak ditemukan di faskes ini");
      await query(`UPDATE hr_cakupan_unit SET deleted_at = $1, updated_at = $1 WHERE faskes_uuid = $2 AND lower(username) = lower($3) AND unit_uuid = $4 AND aksi = $5 AND deleted_at IS NULL`, [sekarang(), f, username, unit, b.aksi], k);
      if (boolean(b.aktif, "aktif")) r = await buat("hr_cakupan_unit", req, { username, unit_uuid: unit, aksi: b.aksi }, k);
    }
    await audit(req, "hr_cakupan_unit", r?.uuid ?? null, { alasan, kepegawaian_uuid: b.kepegawaian_uuid ?? null,
      atasan_uuid: b.atasan_uuid ?? null, username: b.username ?? null, unit_uuid: b.unit_uuid ?? null, aksi: b.aksi ?? null, aktif: b.aktif ?? null }, k);
    return r ?? { dicabut: true };
  }), "Penugasan berhasil dicatat");
}));

export default rute;
