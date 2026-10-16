import express from "express";
import { query, satu, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { STATUS_PENANGANAN_RECALL, STATUS_RECALL, cekPilihan, daftarNilai, teks } from "./bersama.js";
import { izinCssd } from "../umum/izin.js";

// Recall: daftar set terdampak dari satu load gagal (set, lokasi/unit terakhir, dan pemakaian pasien terkait —
// KF-22), beserta pencatatan tindak lanjut per set (KF-23). Recall dibuat otomatis saat load dinyatakan gagal.

export const rute = express.Router();

rute.get(
  "/recall",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "r.faskes_uuid = $1";
    const status = daftarNilai(req.query.status);
    if (status.length) {
      p.push(status);
      w += ` AND r.status = ANY($${p.length})`;
    }
    if (req.query.dari) {
      p.push(Number(req.query.dari));
      w += ` AND r.waktu_dibuka >= $${p.length}`;
    }
    if (req.query.sampai) {
      p.push(Number(req.query.sampai));
      w += ` AND r.waktu_dibuka <= $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM cssd_recall r WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT r.uuid, r.load_uuid, l.nomor_load, r.status, r.waktu_dibuka, r.waktu_selesai,
              (SELECT COUNT(*) FROM cssd_recall_set rs WHERE rs.recall_uuid = r.uuid)::int AS jumlah_set,
              (SELECT COUNT(*) FROM cssd_recall_set rs WHERE rs.recall_uuid = r.uuid AND rs.status_penanganan = 'belum_ditindaklanjuti')::int AS jumlah_belum_ditindaklanjuti
         FROM cssd_recall r JOIN cssd_load l ON l.uuid = r.load_uuid
        WHERE ${w} ORDER BY r.waktu_dibuka DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Daftar recall langsung dari satu load (dipakai juga oleh layar Load untuk tautan cepat ke recall).
rute.get(
  "/load/:uuid/recall",
  izinCssd("Recall", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const l = await satu(
      `SELECT uuid, nomor_load, metode, status, hasil_indikator_kimia, hasil_indikator_biologi, waktu_mulai, waktu_selesai
         FROM cssd_load WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
      [req.params.uuid, faskes],
    );
    if (!l) throw tidakDitemukan("Load");
    const recall = await satu(`SELECT uuid, status, catatan, dibuka_oleh, waktu_dibuka, waktu_selesai FROM cssd_recall WHERE load_uuid = $1 AND faskes_uuid = $2`, [l.uuid, faskes]);
    if (!recall) return kirim(res, { load: l, recall: null, set: [] });

    const set = await query(
      `SELECT s.uuid, s.kode_set_fisik, s.kode_barcode, s.status, s.lokasi_tipe, s.lokasi_uuid, ms.nama_set,
              rs.status_penanganan, rs.catatan AS catatan_penanganan, rs.petugas_uuid AS petugas_penanganan_uuid, rs.waktu AS waktu_penanganan,
              (SELECT COALESCE(json_agg(json_build_object(
                  'uuid', pk.uuid, 'pasien_uuid', pk.pasien_uuid, 'kunjungan_uuid', pk.kunjungan_uuid,
                  'nama_tindakan', pk.nama_tindakan, 'unit_uuid', pk.unit_uuid, 'waktu_pakai', pk.waktu_pakai,
                  'nama_pasien', p.name, 'no_rm', p.no_rm
                ) ORDER BY pk.waktu_pakai), '[]')
                 FROM cssd_pemakaian pk LEFT JOIN patients p ON p.uuid = pk.pasien_uuid
                WHERE pk.set_uuid = s.uuid AND pk.load_asal_uuid = $1 AND pk.deleted_at IS NULL) AS pemakaian
         FROM cssd_recall_set rs JOIN cssd_set s ON s.uuid = rs.set_uuid JOIN cssd_master_set ms ON ms.uuid = s.master_set_uuid
        WHERE rs.recall_uuid = $2 ORDER BY s.kode_set_fisik`,
      [l.uuid, recall.uuid],
    );
    kirim(res, { load: l, recall, set });
  }),
);

rute.put(
  "/recall/:uuid/set/:setUuid",
  izinCssd("Recall", "TINDAK LANJUT"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const statusPenanganan = cekPilihan(req.body?.status_penanganan, STATUS_PENANGANAN_RECALL, "status_penanganan");
    if (!statusPenanganan) throw permintaanSalah("status_penanganan wajib diisi");
    const recall = await satu(`SELECT uuid FROM cssd_recall WHERE uuid = $1 AND faskes_uuid = $2`, [req.params.uuid, faskes]);
    if (!recall) throw tidakDitemukan("Recall");
    const rs = await satu(
      `UPDATE cssd_recall_set SET status_penanganan = $1, catatan = $2, petugas_uuid = $3, waktu = $4, updated_at = $5
        WHERE recall_uuid = $6 AND set_uuid = $7 RETURNING uuid, set_uuid, status_penanganan`,
      [statusPenanganan, teks(req.body?.catatan), teks(req.body?.petugas_uuid), Number(req.body?.waktu) || sekarang(), sekarang(), recall.uuid, req.params.setUuid],
    );
    if (!rs) throw tidakDitemukan("Set pada recall ini");

    // Bila seluruh set sudah ditindaklanjuti, tandai recall selesai; sebagian → ditindaklanjuti.
    const ringkas = await satu(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status_penanganan = 'belum_ditindaklanjuti')::int AS belum FROM cssd_recall_set WHERE recall_uuid = $1`,
      [recall.uuid],
    );
    const statusRecall = ringkas.belum === 0 ? "selesai" : "ditindaklanjuti";
    await query(`UPDATE cssd_recall SET status = $1, waktu_selesai = CASE WHEN $1 = 'selesai' THEN $2 ELSE waktu_selesai END, updated_at = $2 WHERE uuid = $3`, [
      statusRecall,
      sekarang(),
      recall.uuid,
    ]);
    kirim(res, rs, "Tindak lanjut recall tercatat");
  }),
);

export const referensiStatus = () => ({ status_recall: STATUS_RECALL, status_penanganan: STATUS_PENANGANAN_RECALL });
