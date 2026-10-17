import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { ramah } from "./bersama.js";

// Master ruang OK (Datamaster › Kamar Operasi › Ruang OK). Ruang tidak dihapus permanen; nonaktifkan agar tidak
// bisa dipilih pada penjadwalan baru (jadwal yang sudah ada tetap tertaut).
const rute = express.Router();

rute.get(
  "/",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hanyaAktif = ["1", "true"].includes(String(req.query.aktif));
    kirim(
      res,
      await query(
        `SELECT uuid, kode, nama, lokasi_uuid, jam_mulai, jam_selesai, aktif, created_at::float8 AS created_at
           FROM ok_ruang WHERE faskes_uuid = $1 AND deleted_at IS NULL ${hanyaAktif ? "AND aktif" : ""} ORDER BY kode`,
        [f],
      ),
    );
  }),
);

rute.post(
  "/",
  izinOk("Datamaster", "CREATE", "Ruang OK"),
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama"]);
    const f = req.author.faskesUuid;
    const ruang = await sisipkan(
      "ok_ruang",
      {
        faskes_uuid: f,
        kode: String(req.body.kode).trim(),
        nama: String(req.body.nama).trim(),
        lokasi_uuid: req.body.lokasi_uuid || null,
        jam_mulai: req.body.jam_mulai || null,
        jam_selesai: req.body.jam_selesai || null,
        aktif: req.body.aktif ?? true,
      },
    ).catch((e) => ramah(e, `Kode ruang OK ${req.body.kode} sudah dipakai`));
    kirim(res, ruang, `Ruang OK ${ruang.nama} berhasil ditambahkan`);
  }),
);

rute.put(
  "/:uuid",
  izinOk("Datamaster", "UPDATE", "Ruang OK"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const ada = await satu(`SELECT uuid FROM ok_ruang WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f]);
    if (!ada) throw tidakDitemukan("Ruang OK");
    const b = req.body;
    const ruang = await ubah(
      "ok_ruang",
      req.params.uuid,
      f,
      {
        kode: b.kode === undefined ? undefined : String(b.kode).trim(),
        nama: b.nama === undefined ? undefined : String(b.nama).trim(),
        lokasi_uuid: b.lokasi_uuid,
        jam_mulai: b.jam_mulai,
        jam_selesai: b.jam_selesai,
        aktif: b.aktif,
      },
    ).catch((e) => ramah(e, `Kode ruang OK ${b.kode} sudah dipakai`));
    kirim(res, ruang, "Ruang OK berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izinOk("Datamaster", "DELETE", "Ruang OK"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const ruang = await ubah("ok_ruang", req.params.uuid, f, { deleted_at: sekarang() });
    if (!ruang) throw tidakDitemukan("Ruang OK");
    kirim(res, ruang, "Ruang OK berhasil dinonaktifkan");
  }),
);

export default rute;
