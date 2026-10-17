import express from "express";
import { satu, query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { tanggalValid, tglLokal } from "./bersama.js";

// Laporan rekap operasi (KF-20/KT-20): jumlah per operator & per kelas operasi (kecil/sedang/besar/khusus) dari
// jadwal yang dilaksanakan pada periode (waktu_mulai), serta persentase pembatalan jadwal pada periode yang sama.
const rute = express.Router();

// ?tanggal_dari=&tanggal_sampai=&operator_uuid=&kelas_operasi=
rute.get(
  "/laporan/rekap",
  izinOk("Laporan Rekap", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "j.faskes_uuid = $1 AND j.deleted_at IS NULL";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.tanggal_dari) tambah(tanggalValid(q.tanggal_dari, "tanggal_dari"), `${tglLokal("j.waktu_mulai")} >= $?::date`);
    if (q.tanggal_sampai) tambah(tanggalValid(q.tanggal_sampai, "tanggal_sampai"), `${tglLokal("j.waktu_mulai")} <= $?::date`);

    const DARI = `ok_jadwal j JOIN ok_order o ON o.uuid = j.order_uuid`;
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const batal = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w} AND j.status = 'batal'`, p)).n;

    const kelasSubselect = `
      SELECT COALESCE(
        (SELECT ot.kelas_operasi FROM ok_order_tindakan ot WHERE ot.order_uuid = o.uuid AND ot.deleted_at IS NULL
          ORDER BY CASE ot.kelas_operasi WHEN 'khusus' THEN 4 WHEN 'besar' THEN 3 WHEN 'sedang' THEN 2 WHEN 'kecil' THEN 1 ELSE 0 END DESC
          LIMIT 1),
        'kecil')`;

    const perKelas = await query(
      `SELECT (${kelasSubselect}) AS kelas_operasi, COUNT(*)::int AS jumlah
         FROM ${DARI} WHERE ${w} AND j.status = 'selesai' GROUP BY 1 ORDER BY 1`,
      p,
    );

    const perOperator = await query(
      `SELECT jt.practitioner_uuid,
              TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama,
              COUNT(*)::int AS jumlah
         FROM ${DARI} JOIN ok_jadwal_tim jt ON jt.jadwal_uuid = j.uuid AND jt.peran = 'operator' AND jt.deleted_at IS NULL
         LEFT JOIN practitioner pr ON pr.uuid = jt.practitioner_uuid
         LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
        WHERE ${w} AND j.status = 'selesai'
        GROUP BY jt.practitioner_uuid, nama ORDER BY jumlah DESC`,
      p,
    );

    kirim(res, {
      periode: { dari: q.tanggal_dari ?? null, sampai: q.tanggal_sampai ?? null },
      total: Number(total),
      per_operator: perOperator,
      per_kelas: perKelas,
      pembatalan: { jumlah: Number(batal), persentase: total > 0 ? Math.round((Number(batal) / Number(total)) * 1000) / 10 : 0 },
    });
  }),
);

export default rute;
