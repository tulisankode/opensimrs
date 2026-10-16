import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { AMBANG_KEDALUWARSA_HARI, KONDISI_SERAH, STATUS_PERMINTAAN, STATUS_SET } from "./bersama.js";
import { master, mesin, referensiPilihan } from "./master.js";
import { rute as proses } from "./proses.js";
import { rute as distribusi } from "./distribusi.js";
import { rute as recall, referensiStatus } from "./recall.js";
import { rute as laporan } from "./laporan.js";

// CSSD (Sterilisasi Alat & Pelacakan Set Instrumen) — /api/v3/penunjang/cssd/...
//   /master-set, /master-set/:uuid/set, /master-set/:uuid/label  datamaster set & set fisik berbarcode
//   /mesin, /mesin/:uuid/bowie-dick                               datamaster mesin & uji Bowie-Dick harian
//   /penerimaan-kotor, /set/:uuid/dekontaminasi, /set, /set/:uuid pemrosesan & jejak set
//   /load, /load/:uuid/hasil                                      siklus sterilisasi & penetapan kelayakan otomatis
//   /stok, /permintaan, /distribusi, /pemakaian                   penyimpanan, distribusi & pemakaian pasien
//   /recall, /load/:uuid/recall                                   recall dari load gagal & tindak lanjut
//   /laporan/volume|kegagalan|set-bermasalah                      laporan CSSD
//   /referensi/pilihan|unit|pasien
const rute = express.Router();

rute.use("/master-set", master);
rute.use("/mesin", mesin);
rute.use("/", proses);
rute.use("/", distribusi);
rute.use("/", recall);
rute.use("/laporan", laporan);

// Pilihan enum untuk form frontend.
rute.get(
  "/referensi/pilihan",
  tangani(async (req, res) =>
    kirim(res, {
      ...referensiPilihan(),
      status_set: STATUS_SET,
      status_permintaan: STATUS_PERMINTAAN,
      kondisi_serah: KONDISI_SERAH,
      ...referensiStatus(),
      ambang_kedaluwarsa_hari: AMBANG_KEDALUWARSA_HARI,
    }),
  ),
);

// Unit/ruangan terdaftar faskes sebagai pilihan unit asal/tujuan (cakupan tidak dibatasi OK/IGD — KF-15).
rute.get(
  "/referensi/unit",
  tangani(async (req, res) =>
    kirim(
      res,
      await query(`SELECT uuid, name AS nama, location_type, pelayanan FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [req.author.faskesUuid]),
    ),
  ),
);

// Pencarian pasien terdaftar untuk pencatatan pemakaian tanpa nomor registrasi (nama / No. RM / NIK).
rute.get(
  "/referensi/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status IS NOT FALSE";
    if (cari) {
      p.push(`%${cari}%`);
      w += ` AND (p.name ILIKE $2 OR p.no_rm ILIKE $2 OR p.no_identity ILIKE $2)`;
    }
    kirim(res, await query(`SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity FROM patients p WHERE ${w} ORDER BY p.created_at DESC LIMIT 20`, p));
  }),
);

export default rute;
