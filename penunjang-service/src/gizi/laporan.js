import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { izinGizi } from "../umum/izin.js";
import { rentangOpsional, tglLokal } from "./bersama.js";

const rute = express.Router();

// Jumlah pasien rawat inap aktif saat ini per jenis diet (dari order diet yang berlaku), opsional difilter ruangan.
rute.get(
  "/jumlah-diet",
  izinGizi("Laporan Gizi", "READ"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = `ri.faskes_uuid = $1 AND ri.deleted_at IS NULL AND ri.status_ri IN (1, 2, 3)`;
    if (req.query.ruangan_uuid) {
      p.push(req.query.ruangan_uuid);
      w += ` AND ri.lokasi_uuid = $${p.length}`;
    }
    const rows = await query(
      `SELECT d.nama_diet, COUNT(*)::int AS jumlah_pasien
         FROM rawat_inaps ri
         JOIN gizi_order_diet o ON o.admission_ri_uuid = ri.uuid AND o.faskes_uuid = ri.faskes_uuid AND o.status = 'aktif' AND o.deleted_at IS NULL
         JOIN gizi_master_diet d ON d.uuid = o.diet_uuid
        WHERE ${w}
        GROUP BY d.nama_diet ORDER BY d.nama_diet`,
      p,
    );
    kirim(res, rows);
  }),
);

// Cakupan skrining gizi: persentase pasien rawat inap baru (tanggal_dirawat dalam rentang) yang sudah diskrining
// dalam batas 1x24 jam sejak masuk.
rute.get(
  "/cakupan-skrining",
  izinGizi("Laporan Gizi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const rentang = rentangOpsional(req.query);
    const p = [f];
    let w = `ri.faskes_uuid = $1 AND ri.deleted_at IS NULL AND ri.encounter = 'RI' AND ri.status_ri <> 0`;
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("ri.tanggal_dirawat")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*)::int n FROM rawat_inaps ri WHERE ${w}`, p)).n;
    const tepatWaktu = (
      await satu(
        `SELECT COUNT(*)::int n FROM rawat_inaps ri WHERE ${w} AND EXISTS (
           SELECT 1 FROM gizi_skrining s WHERE s.admission_ri_uuid = ri.uuid AND s.faskes_uuid = ri.faskes_uuid
             AND s.deleted_at IS NULL AND s.waktu_skrining <= COALESCE(ri.tanggal_dirawat, 0) + 86400
         )`,
        p,
      )
    ).n;
    kirim(res, {
      total_pasien: total,
      terskrining_tepat_waktu: tepatWaktu,
      persentase: total > 0 ? Math.round((tepatWaktu / total) * 10000) / 100 : 0,
    });
  }),
);

export default rute;
