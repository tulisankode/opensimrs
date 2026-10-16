import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { hariIni, tanggalValid, tglLokal } from "./bersama.js";

// Laporan BDRS: pemakaian darah per golongan/komponen/ruangan, rasio crossmatch-transfusi (C/T), kantong
// kedaluwarsa/dimusnahkan/dikembalikan, dan rekap reaksi transfusi (hemovigilans) — KF-21.
const rute = express.Router();

const rentang = (q) => {
  const mulai = tanggalValid(q.tanggal_mulai || hariIni(), "tanggal_mulai");
  const selesai = tanggalValid(q.tanggal_selesai || mulai, "tanggal_selesai");
  return { mulai, selesai };
};

// Pemakaian darah: kantong yang benar-benar diserahkan (serah terima selesai) pada periode, per golongan/komponen/ruangan.
rute.get(
  "/pemakaian",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    const w = `st.faskes_uuid = $1 AND st.status = 'selesai' AND i.deleted_at IS NULL AND ${tglLokal("st.updated_at")} BETWEEN $2 AND $3`;
    const DARI = `FROM bdrs_serah_terima_item i JOIN bdrs_serah_terima st ON st.uuid = i.serah_terima_uuid
                  JOIN bdrs_permintaan pm ON pm.uuid = st.permintaan_uuid JOIN bdrs_stok s ON s.uuid = i.stok_uuid
                  LEFT JOIN bdrs_komponen_darah k ON k.uuid = s.komponen_uuid
                  LEFT JOIN lokasi l ON l.uuid = pm.lokasi_asal_uuid`;
    const [ringkasan, perGolongan, perKomponen, perRuangan, perHari] = await Promise.all([
      satu(`SELECT COUNT(*)::int AS jumlah_kantong, COUNT(DISTINCT pm.uuid)::int AS jumlah_permintaan, COUNT(DISTINCT pm.patient_uuid)::int AS jumlah_pasien ${DARI} WHERE ${w}`, p),
      query(`SELECT s.golongan_abo, s.rhesus, COUNT(*)::int AS jumlah ${DARI} WHERE ${w} GROUP BY s.golongan_abo, s.rhesus ORDER BY jumlah DESC`, p),
      query(`SELECT s.komponen_uuid, MAX(k.nama) AS komponen_nama, COUNT(*)::int AS jumlah ${DARI} WHERE ${w} GROUP BY s.komponen_uuid ORDER BY jumlah DESC`, p),
      query(`SELECT pm.lokasi_asal_uuid, MAX(l.name) AS lokasi_asal, COUNT(*)::int AS jumlah ${DARI} WHERE ${w} GROUP BY pm.lokasi_asal_uuid ORDER BY jumlah DESC`, p),
      query(`SELECT to_char(${tglLokal("st.updated_at")}, 'YYYY-MM-DD') AS tanggal, COUNT(*)::int AS jumlah ${DARI} WHERE ${w} GROUP BY 1 ORDER BY 1`, p),
    ]);
    kirim(res, { tanggal_mulai: mulai, tanggal_selesai: selesai, ringkasan, per_golongan: perGolongan, per_komponen: perKomponen, per_ruangan: perRuangan, per_hari: perHari });
  }),
);

// Rasio C/T = jumlah kantong yang menjalani crossmatch dibagi jumlah kantong yang benar-benar ditransfusikan (KT-15).
rute.get(
  "/rasio-crossmatch-transfusi",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    const crossmatch = await satu(
      `SELECT COUNT(*)::int n FROM bdrs_crossmatch c WHERE c.faskes_uuid = $1 AND c.deleted_at IS NULL AND ${tglLokal("c.waktu_periksa")} BETWEEN $2 AND $3`,
      p,
    );
    const transfusi = await satu(
      `SELECT COUNT(*)::int n FROM bdrs_transfusi t WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.status IN ('selesai_tanpa_reaksi', 'reaksi')
         AND ${tglLokal("COALESCE(t.waktu_selesai, t.waktu_mulai)")} BETWEEN $2 AND $3`,
      p,
    );
    kirim(res, {
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      jumlah_crossmatch: crossmatch.n,
      jumlah_transfusi: transfusi.n,
      rasio_c_t: transfusi.n > 0 ? Number((crossmatch.n / transfusi.n).toFixed(2)) : null,
    });
  }),
);

// Kantong yang kedaluwarsa, dimusnahkan, atau dikembalikan pada periode (berdasarkan waktu pembaruan status).
rute.get(
  "/stok-keluar",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    const rows = await query(
      `SELECT s.uuid, s.no_kantong, s.golongan_abo, s.rhesus, k.nama AS komponen_nama, s.tanggal_kedaluwarsa, s.status, s.alasan_keluar, s.updated_at
         FROM bdrs_stok s LEFT JOIN bdrs_komponen_darah k ON k.uuid = s.komponen_uuid
        WHERE s.faskes_uuid = $1 AND s.status IN ('kedaluwarsa', 'dimusnahkan', 'dikembalikan') AND ${tglLokal("s.updated_at")} BETWEEN $2 AND $3
        ORDER BY s.updated_at DESC`,
      p,
    );
    kirim(res, { tanggal_mulai: mulai, tanggal_selesai: selesai, items: rows });
  }),
);

// Rekap reaksi transfusi (hemovigilans) per periode.
rute.get(
  "/reaksi",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    const DARI = `FROM bdrs_reaksi_transfusi r
                  JOIN bdrs_transfusi t ON t.uuid = r.transfusi_uuid
                  JOIN bdrs_serah_terima_item i ON i.uuid = t.serah_terima_item_uuid
                  JOIN bdrs_serah_terima st ON st.uuid = i.serah_terima_uuid
                  JOIN bdrs_permintaan pm ON pm.uuid = st.permintaan_uuid
                  LEFT JOIN patients p2 ON p2.uuid = pm.patient_uuid`;
    const w = `r.faskes_uuid = $1 AND r.deleted_at IS NULL AND ${tglLokal("r.created_at")} BETWEEN $2 AND $3`;
    const [ringkasan, perJenis, items] = await Promise.all([
      satu(`SELECT COUNT(*)::int AS jumlah_reaksi, COUNT(*) FILTER (WHERE r.status_tindak_lanjut <> 'selesai')::int AS belum_selesai ${DARI} WHERE ${w}`, p),
      query(`SELECT r.jenis_reaksi, COUNT(*)::int AS jumlah ${DARI} WHERE ${w} GROUP BY r.jenis_reaksi ORDER BY jumlah DESC`, p),
      query(`SELECT r.uuid, r.jenis_reaksi, r.gejala, r.status_tindak_lanjut, r.created_at, pm.no_permintaan, pm.no_rm, p2.name AS nama_pasien ${DARI} WHERE ${w} ORDER BY r.created_at DESC`, p),
    ]);
    kirim(res, { tanggal_mulai: mulai, tanggal_selesai: selesai, ringkasan, per_jenis: perJenis, items });
  }),
);

export default rute;
