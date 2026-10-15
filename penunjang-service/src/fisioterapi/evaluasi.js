import express from "express";
import { query, satu, sisipkan, ubah, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { FASE_REHAB } from "./bersama.js";
import { ambilOrder, selaraskanStatus } from "./order.js";

// Evaluasi Rehab Medik per sesi (SOAP + fase rehabilitasi + inform consent) dan riwayat terapi pasien.
const rute = express.Router();

const PILIH_EVALUASI = `
  e.uuid, e.order_uuid, e.jadwal_uuid, e.subjektif, e.objektif, e.asesmen, e.intervensi, e.evaluasi, e.edukasi,
  e.fase_rehabilitasi, e.persetujuan, e.terapis, e.created_at::float8 AS created_at, e.updated_at::float8 AS updated_at,
  to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, j.jam_slot, j.sesi_ke, b.nama AS bed,
  o.no_order, o.jenis_fisio, o.jumlah_sesi, o.diagnosis, o.keluhan, o.patient_uuid, o.no_rm, p.name AS nama_pasien`;
const DARI_EVALUASI = `
  fisio_evaluasi e
  JOIN fisio_order o ON o.uuid = e.order_uuid
  LEFT JOIN fisio_jadwal j ON j.uuid = e.jadwal_uuid
  LEFT JOIN fisio_bed b ON b.uuid = j.bed_uuid
  LEFT JOIN patients p ON p.uuid = o.patient_uuid`;

// Isian evaluasi dari body. persetujuan: { jenis: 'persetujuan'|'penolakan', nama, hubungan, tindakan, saksi, ... }.
const isian = (b) => {
  if (b.fase_rehabilitasi && !FASE_REHAB.includes(String(b.fase_rehabilitasi)))
    throw permintaanSalah(`fase_rehabilitasi harus salah satu: ${FASE_REHAB.join(", ")}`);
  if (b.persetujuan && b.persetujuan.jenis && !["persetujuan", "penolakan"].includes(b.persetujuan.jenis))
    throw permintaanSalah("persetujuan.jenis harus persetujuan atau penolakan");
  return {
    subjektif: b.subjektif,
    objektif: b.objektif,
    asesmen: b.asesmen,
    intervensi: b.intervensi,
    evaluasi: b.evaluasi,
    edukasi: b.edukasi,
    fase_rehabilitasi: b.fase_rehabilitasi === undefined ? undefined : b.fase_rehabilitasi || null,
    persetujuan: b.persetujuan,
    terapis: b.terapis,
  };
};

const satuEvaluasi = (uuid, faskesUuid, k) => satu(`SELECT ${PILIH_EVALUASI} FROM ${DARI_EVALUASI} WHERE e.uuid = $1 AND e.faskes_uuid = $2`, [uuid, faskesUuid], k);

// GET /evaluasi?order_uuid=&patient_uuid=&cari=
rute.get(
  "/",
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "e.faskes_uuid = $1 AND e.deleted_at IS NULL";
    if (q.order_uuid) (p.push(q.order_uuid), (w += ` AND e.order_uuid = $${p.length}`));
    if (q.patient_uuid) (p.push(q.patient_uuid), (w += ` AND o.patient_uuid = $${p.length}`));
    if (q.cari) (p.push(`%${q.cari}%`), (w += ` AND (p.name ILIKE $${p.length} OR o.no_rm ILIKE $${p.length} OR o.no_order ILIKE $${p.length})`));
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_EVALUASI} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH_EVALUASI} FROM ${DARI_EVALUASI} WHERE ${w} ORDER BY j.tanggal DESC NULLS LAST, j.jam_slot DESC, e.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// GET /evaluasi/riwayat/:patient_uuid — riwayat kunjungan/terapi pasien: per order beserta evaluasi tiap sesi.
rute.get(
  "/riwayat/:patientUuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const order = await query(
      `SELECT o.uuid, o.no_order, o.jenis_fisio, o.diagnosis, o.keluhan, o.jumlah_sesi, o.status, o.sumber, o.created_at::float8 AS created_at,
              (SELECT string_agg(t.nama, ', ' ORDER BY t.nama) FROM fisio_order_tindakan t WHERE t.order_uuid = o.uuid AND t.deleted_at IS NULL) AS tindakan_ringkas
         FROM fisio_order o WHERE o.patient_uuid = $1 AND o.faskes_uuid = $2 AND o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 50`,
      [req.params.patientUuid, f],
    );
    const evaluasi = order.length
      ? await query(`SELECT ${PILIH_EVALUASI} FROM ${DARI_EVALUASI} WHERE e.order_uuid = ANY($1) AND e.deleted_at IS NULL ORDER BY j.tanggal DESC NULLS LAST, j.jam_slot DESC`, [
          order.map((o) => o.uuid),
        ])
      : [];
    kirim(res, order.map((o) => ({ ...o, evaluasi: evaluasi.filter((e) => e.order_uuid === o.uuid) })));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const e = await satuEvaluasi(req.params.uuid, req.author.faskesUuid);
    if (!e) throw tidakDitemukan("Evaluasi");
    kirim(res, e);
  }),
);

// POST /evaluasi { jadwal_uuid, subjektif, objektif, asesmen, intervensi, evaluasi, edukasi, fase_rehabilitasi, persetujuan, terapis }
// Sesi menjadi selesai; order selesai bila seluruh sesi sudah dievaluasi. Bila sesi sudah punya evaluasi, isinya diperbarui.
rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["jadwal_uuid"]);
    const f = req.author.faskesUuid;
    const data = isian(req.body);
    const hasil = await transaksi(async (k) => {
      const j = await satu(`SELECT * FROM fisio_jadwal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.body.jadwal_uuid, f], k);
      if (!j) throw tidakDitemukan("Jadwal");
      if (!j.order_uuid) throw new Galat(409, "Booking belum dilanjutkan menjadi order");
      if (j.status === "batal") throw new Galat(409, "Jadwal sudah dibatalkan");
      const o = await ambilOrder(j.order_uuid, f, k);
      if (!["valid", "terjadwal", "selesai"].includes(o.status)) throw new Galat(409, o.status === "order" ? "Order belum divalidasi" : `Order berstatus ${o.status}`);
      const ada = await satu(`SELECT uuid FROM fisio_evaluasi WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [j.uuid], k);
      const e = ada
        ? await ubah("fisio_evaluasi", ada.uuid, f, data, k)
        : await sisipkan(
            "fisio_evaluasi",
            Object.fromEntries(
              Object.entries({ faskes_uuid: f, order_uuid: o.uuid, jadwal_uuid: j.uuid, ...data, terapis: data.terapis || req.author.username || null }).filter(
                ([, v]) => v !== undefined,
              ),
            ),
            k,
          );
      if (j.status !== "selesai") await ubah("fisio_jadwal", j.uuid, f, { status: "selesai" }, k);
      await selaraskanStatus(o.uuid, f, k);
      return satuEvaluasi(e.uuid, f, k);
    });
    kirim(res, hasil, `Evaluasi sesi ${hasil.sesi_ke ?? ""} berhasil disimpan`.replace("  ", " "));
  }),
);

// PUT /evaluasi/:uuid — koreksi isi evaluasi (order belum batal).
rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const lama = await satuEvaluasi(req.params.uuid, f);
    if (!lama) throw tidakDitemukan("Evaluasi");
    await ubah("fisio_evaluasi", lama.uuid, f, isian(req.body));
    kirim(res, await satuEvaluasi(lama.uuid, f), "Evaluasi berhasil diperbarui");
  }),
);

export default rute;
