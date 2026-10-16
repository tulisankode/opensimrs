import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { tglLokal } from "./bersama.js";
import { izinCssd } from "../umum/izin.js";

// Laporan CSSD: volume sterilisasi per unit/metode/periode, kegagalan indikator & Bowie-Dick, set bermasalah.

export const rute = express.Router();
rute.use(izinCssd("Laporan CSSD", "READ"));

const rentangWaktu = (req, p, kolom) => {
  let w = "";
  if (req.query.dari) {
    p.push(Number(req.query.dari));
    w += ` AND ${kolom} >= $${p.length}`;
  }
  if (req.query.sampai) {
    p.push(Number(req.query.sampai));
    w += ` AND ${kolom} <= $${p.length}`;
  }
  return w;
};

rute.get(
  "/volume",
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "l.faskes_uuid = $1 AND l.deleted_at IS NULL" + rentangWaktu(req, p, "l.waktu_mulai");
    if (req.query.metode) {
      p.push(String(req.query.metode));
      w += ` AND l.metode = $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT ${tglLokal("l.waktu_mulai")} AS tanggal, l.metode, m.nama_mesin,
                COUNT(DISTINCT l.uuid)::int AS jumlah_load, COUNT(ls.set_uuid)::int AS jumlah_set
           FROM cssd_load l JOIN cssd_mesin m ON m.uuid = l.mesin_uuid LEFT JOIN cssd_load_set ls ON ls.load_uuid = l.uuid AND ls.deleted_at IS NULL
          WHERE ${w} GROUP BY 1, l.metode, m.nama_mesin ORDER BY 1 DESC`,
        p,
      ),
    );
  }),
);

rute.get(
  "/kegagalan",
  tangani(async (req, res) => {
    const p1 = [req.author.faskesUuid];
    const w1 = "faskes_uuid = $1 AND deleted_at IS NULL AND status = 'gagal'" + rentangWaktu(req, p1, "waktu_mulai");
    const p2 = [req.author.faskesUuid];
    const w2 = "faskes_uuid = $1 AND hasil = 'gagal'" + rentangWaktu(req, p2, "EXTRACT(EPOCH FROM tanggal)::bigint");
    const [load, bowieDick] = await Promise.all([
      query(`SELECT uuid, nomor_load, metode, hasil_indikator_kimia, hasil_indikator_biologi, waktu_mulai FROM cssd_load WHERE ${w1} ORDER BY waktu_mulai DESC`, p1),
      query(`SELECT bd.uuid, bd.tanggal, bd.catatan, m.nama_mesin FROM cssd_bowie_dick bd JOIN cssd_mesin m ON m.uuid = bd.mesin_uuid WHERE ${w2} ORDER BY bd.tanggal DESC`, p2),
    ]);
    kirim(res, { load_gagal: load, bowie_dick_gagal: bowieDick, ringkasan: { jumlah_load_gagal: load.length, jumlah_bowie_dick_gagal: bowieDick.length } });
  }),
);

rute.get(
  "/set-bermasalah",
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    const status = req.query.status ? [String(req.query.status)] : ["hilang", "rusak", "dikarantina"];
    p.push(status);
    let w = "s.faskes_uuid = $1 AND s.status = ANY($2) AND s.deleted_at IS NULL";
    w += rentangWaktu(req, p, "s.updated_at");
    kirim(
      res,
      await query(
        `SELECT s.uuid, s.kode_set_fisik, s.kode_barcode, s.status, s.lokasi_tipe, s.lokasi_uuid, s.updated_at, ms.nama_set
           FROM cssd_set s JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid WHERE ${w} ORDER BY s.updated_at DESC`,
        p,
      ),
    );
  }),
);
