import express from "express";
import { query, satu, sisipkan, sekarang, uuidv7 } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah, wajib } from "../umum/respons.js";
import { izinKoding } from "../umum/izin.js";
import { ambilKoding, checklistKunjungan, satuKunjunganSumber } from "./data.js";
import { KUNJUNGAN_TIPE, TABEL_KUNJUNGAN, STATUS_CHECKLIST, teks, tglLokal } from "./bersama.js";

// Checklist kelengkapan rekam medis — /api/v3/penunjang/koding/...
//   /checklist/master              master item checklist per faskes (CRUD ringan)
//   /kunjungan/:tipe/:uuid/checklist   status checklist satu kunjungan (GET/PUT)
//   /checklist/rekap-dpjp           rekap lengkap/tidak lengkap per DPJP per periode
const rute = express.Router();

rute.get(
  "/checklist/master",
  izinKoding("Checklist", "READ"),
  tangani(async (req, res) =>
    kirim(
      res,
      await query(
        `SELECT * FROM koding_checklist_item WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY urutan, nama`,
        [req.author.faskesUuid],
      ),
    ),
  ),
);

rute.post(
  "/checklist/master",
  izinKoding("Checklist", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["nama"]);
    const berlaku = Array.isArray(b.berlaku_kunjungan_tipe) ? b.berlaku_kunjungan_tipe.filter((t) => KUNJUNGAN_TIPE.includes(t)) : null;
    const r = await sisipkan("koding_checklist_item", {
      faskes_uuid: req.author.faskesUuid, nama: teks(b.nama, 200), berlaku_kunjungan_tipe: berlaku?.length ? berlaku : null,
      wajib: b.wajib !== false, urutan: Number(b.urutan) || 0, status: b.status !== false,
    }).catch((e) => {
      if (e?.code === "23505") throw permintaanSalah("Nama item checklist sudah dipakai");
      throw e;
    });
    kirim(res, r, "Item checklist disimpan");
  }),
);

rute.put(
  "/checklist/master/:uuid",
  izinKoding("Checklist", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const berlaku = b.berlaku_kunjungan_tipe === undefined ? undefined : (Array.isArray(b.berlaku_kunjungan_tipe) ? b.berlaku_kunjungan_tipe.filter((t) => KUNJUNGAN_TIPE.includes(t)) : null);
    const r = await query(
      `UPDATE koding_checklist_item SET nama = COALESCE($1, nama), berlaku_kunjungan_tipe = $2, wajib = COALESCE($3, wajib),
              urutan = COALESCE($4, urutan), status = COALESCE($5, status), updated_at = $6
         WHERE uuid = $7 AND faskes_uuid = $8 AND deleted_at IS NULL RETURNING *`,
      [teks(b.nama, 200) ?? null, berlaku === undefined ? null : (berlaku?.length ? berlaku : null), b.wajib, b.urutan, b.status, sekarang(), req.params.uuid, req.author.faskesUuid],
    );
    if (!r.length) throw permintaanSalah("Item checklist tidak ditemukan");
    kirim(res, r[0], "Item checklist diperbarui");
  }),
);

rute.get(
  "/kunjungan/:tipe/:uuid/checklist",
  izinKoding("Checklist", "READ"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const faskes = req.author.faskesUuid;
    const sumber = await satuKunjunganSumber(tipe, uuid, faskes);
    const koding = await ambilKoding(tipe, uuid, faskes, sumber);
    kirim(res, await checklistKunjungan(koding.uuid, tipe, faskes));
  }),
);

rute.put(
  "/kunjungan/:tipe/:uuid/checklist",
  izinKoding("Checklist", "UPDATE"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const faskes = req.author.faskesUuid;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) throw permintaanSalah("Kirim minimal satu item checklist");
    for (const it of items) {
      if (!STATUS_CHECKLIST.includes(it?.status)) throw permintaanSalah("Status checklist tidak valid");
      if (it.status === "tidak_berlaku" && !teks(it.alasan)) throw permintaanSalah("Alasan wajib diisi untuk item yang ditandai tidak berlaku");
    }
    const sumber = await satuKunjunganSumber(tipe, uuid, faskes);
    const koding = await ambilKoding(tipe, uuid, faskes, sumber);
    const waktu = sekarang();
    for (const it of items) {
      await query(
        `INSERT INTO koding_checklist_kunjungan (uuid, faskes_uuid, koding_kunjungan_uuid, checklist_item_uuid, status, alasan, petugas_uuid, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (koding_kunjungan_uuid, checklist_item_uuid)
         DO UPDATE SET status = EXCLUDED.status, alasan = EXCLUDED.alasan, petugas_uuid = EXCLUDED.petugas_uuid, updated_at = EXCLUDED.updated_at`,
        [uuidv7(), faskes, koding.uuid, it.checklist_item_uuid, it.status, teks(it.alasan) ?? null, req.author.username, waktu],
      );
    }
    kirim(res, await checklistKunjungan(koding.uuid, tipe, faskes), "Checklist diperbarui");
  }),
);

rute.get(
  "/checklist/rekap-dpjp",
  izinKoding("Checklist", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const pg = halaman(req.query);
    const p = [faskes];
    let w = "kk.faskes_uuid = $1 AND kk.deleted_at IS NULL";

    const sumberUnion = KUNJUNGAN_TIPE.map(
      (t) => `SELECT '${t}' AS kunjungan_tipe, r.uuid AS kunjungan_uuid, r.practitioner_uuid, r.discharge_date
                FROM ${TABEL_KUNJUNGAN[t]} r WHERE r.deleted_at IS NULL`,
    ).join(" UNION ALL ");

    if (req.query.periode_mulai) {
      p.push(req.query.periode_mulai, req.query.periode_sampai || req.query.periode_mulai);
      w += ` AND ${tglLokal("s.discharge_date")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (req.query.practitioner_uuid) {
      p.push(req.query.practitioner_uuid);
      w += ` AND s.practitioner_uuid = $${p.length}`;
    }

    const dasar = `
      FROM koding_kunjungan kk
      JOIN (${sumberUnion}) s ON s.kunjungan_tipe = kk.kunjungan_tipe AND s.kunjungan_uuid = kk.kunjungan_uuid
      LEFT JOIN LATERAL (
        SELECT bool_and(COALESCE(ck.status, 'tidak_lengkap') IN ('lengkap', 'tidak_berlaku')) AS lengkap
          FROM koding_checklist_item ci
          LEFT JOIN koding_checklist_kunjungan ck ON ck.checklist_item_uuid = ci.uuid AND ck.koding_kunjungan_uuid = kk.uuid
         WHERE ci.faskes_uuid = kk.faskes_uuid AND ci.status AND ci.wajib
           AND (ci.berlaku_kunjungan_tipe IS NULL OR kk.kunjungan_tipe = ANY(ci.berlaku_kunjungan_tipe))
      ) c ON true`;

    const [rows, total] = await Promise.all([
      query(
        `SELECT s.practitioner_uuid,
                COUNT(*) FILTER (WHERE COALESCE(c.lengkap, true))::int AS jumlah_lengkap,
                COUNT(*) FILTER (WHERE NOT COALESCE(c.lengkap, true))::int AS jumlah_tidak_lengkap,
                COUNT(*)::int AS jumlah_kunjungan
           ${dasar} WHERE ${w} GROUP BY s.practitioner_uuid ORDER BY jumlah_tidak_lengkap DESC
           LIMIT ${pg.limit} OFFSET ${pg.offset}`,
        p,
      ),
      satu(`SELECT COUNT(DISTINCT s.practitioner_uuid)::int n ${dasar} WHERE ${w}`, p),
    ]);
    kirim(res, denganHalaman(rows, total.n, pg));
  }),
);

export default rute;
