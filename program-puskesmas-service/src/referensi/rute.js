import express from "express";
import { query } from "../db.js";
import { tangani, kirim, wajib } from "../umum/respons.js";
import { daftarKunjunganPasien } from "../umum/kunjungan.js";

// Referensi untuk form frontend — /api/v3/program-puskesmas/referensi/...
//   /pasien      pencarian pasien terdaftar (nama/No. RM/NIK) untuk memilih pasien pelayanan program
//   /kunjungan   kunjungan rawat jalan terbaru milik pasien (opsional ?maternity=1 untuk kunjungan kebidanan)
//   /kelurahan   pencarian kelurahan master wilayah untuk sasaran/UKM
const rute = express.Router();

rute.get(
  "/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status IS NOT FALSE";
    if (cari) {
      p.push(`%${cari}%`);
      w += ` AND (p.name ILIKE $2 OR p.no_rm ILIKE $2 OR p.no_identity ILIKE $2)`;
    }
    const rows = await query(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity, bd.birth_date
         FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE ${w} ORDER BY p.created_at DESC LIMIT 20`,
      p,
    );
    kirim(res, rows);
  }),
);

rute.get(
  "/kunjungan",
  tangani(async (req, res) => {
    wajib(req.query, ["patient_uuid"]);
    const maternity = req.query.maternity === "1" ? true : req.query.maternity === "0" ? false : undefined;
    const rows = await daftarKunjunganPasien(req.query.patient_uuid, req.author.faskesUuid, { maternity });
    kirim(res, rows);
  }),
);

rute.get(
  "/kelurahan",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const p = [];
    let w = "1 = 1";
    if (cari) {
      p.push(`%${cari}%`);
      w += ` AND name ILIKE $${p.length}`;
    }
    const rows = await query(`SELECT code, name FROM kelurahan WHERE ${w} ORDER BY name LIMIT 20`, p);
    kirim(res, rows);
  }),
);

export default rute;
