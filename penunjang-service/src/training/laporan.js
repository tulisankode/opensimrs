import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim, halaman, denganHalaman } from "../umum/respons.js";
import { izinTraining } from "../umum/izin.js";
import { rentang } from "./bersama.js";

// Laporan rekapitulasi kunjungan kelas Training: hanya order (KF-16; booking yang belum didaftarkan & batal tidak dihitung), dibatasi faskes dari token.
// Ekspor Excel dibuat di frontend dari data yang sama (lihat pola Fisioterapi), bukan endpoint terpisah,
// agar baris layar & berkas selalu identik (KT-10).
const rute = express.Router();

const DARI = `
  training_order o
  JOIN training_kelas kl ON kl.uuid = o.kelas_uuid
  LEFT JOIN training_kelas_sesi ks ON ks.uuid = o.sesi_uuid
  LEFT JOIN patients p ON p.uuid = o.patient_uuid`;

// GET /rekapitulasi?tanggal_mulai=&tanggal_selesai=&kelas_uuid=&halaman=&limit=
rute.get(
  "/rekapitulasi",
  izinTraining("Laporan", "READ"),
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    let w = "o.faskes_uuid = $1 AND o.status = 'order' AND o.tanggal_kelas BETWEEN $2::date AND $3::date";
    if (req.query.kelas_uuid) {
      p.push(req.query.kelas_uuid);
      w += ` AND o.kelas_uuid = $${p.length}`;
    }
    const [ringkas, rows, perKelas] = await Promise.all([
      satu(`SELECT COUNT(*)::int AS total_peserta, COUNT(DISTINCT o.patient_uuid)::int AS total_pasien, COALESCE(SUM(o.harga), 0)::float8 AS total_tarif FROM ${DARI} WHERE ${w}`, p),
      query(
        `SELECT o.uuid, to_char(o.tanggal_kelas, 'YYYY-MM-DD') AS tanggal_kelas, kl.nama AS kelas_nama, ks.nama_sesi,
                o.no_rm, p.name AS nama_pasien, o.payment_method, o.status, o.harga::float8 AS harga, o.no_order
           FROM ${DARI} WHERE ${w} ORDER BY o.tanggal_kelas DESC, kl.nama, p.name LIMIT ${pg.limit} OFFSET ${pg.offset}`,
        p,
      ),
      query(
        `SELECT kl.uuid AS kelas_uuid, kl.nama AS kelas_nama, COUNT(*)::int AS peserta, COALESCE(SUM(o.harga), 0)::float8 AS tarif
           FROM ${DARI} WHERE ${w} GROUP BY kl.uuid, kl.nama ORDER BY kl.nama`,
        p,
      ),
    ]);
    kirim(res, { periode: { mulai, selesai }, ringkasan: ringkas, per_kelas: perKelas, ...denganHalaman(rows, ringkas.total_peserta, pg) });
  }),
);

export default rute;
