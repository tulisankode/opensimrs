import express from "express";
import { query, satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan } from "../umum/respons.js";
import { izinGizi } from "../umum/izin.js";
import { teks } from "./bersama.js";
import { episodeAktif } from "./rawat_inap.js";
import { skriningTerakhir } from "./skrining.js";

const rute = express.Router();

// Daftar kerja ahli gizi: pasien rawat inap aktif yang skrining terakhirnya "berisiko" dan belum ditindaklanjuti
// dengan asesmen baru (asesmen setelah skrining berisiko tersebut).
rute.get(
  "/asesmen/daftar-kerja",
  izinGizi("Asesmen Gizi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const p = [f];
    let w = `ri.faskes_uuid = $1 AND ri.deleted_at IS NULL AND ri.status_ri IN (1, 2, 3)`;
    if (req.query.ruangan_uuid) {
      p.push(req.query.ruangan_uuid);
      w += ` AND ri.lokasi_uuid = $${p.length}`;
    }
    const rows = await query(
      `SELECT ri.uuid, ri.no_rm, ri.name AS nama_pasien, l.name AS nama_bangsal,
              sk.uuid AS skrining_uuid, sk.skor, sk.kategori_risiko, sk.waktu_skrining
         FROM rawat_inaps ri
         LEFT JOIN lokasi l ON l.uuid = ri.lokasi_uuid
         JOIN LATERAL (
           SELECT * FROM gizi_skrining s WHERE s.admission_ri_uuid = ri.uuid AND s.faskes_uuid = ri.faskes_uuid AND s.deleted_at IS NULL
            ORDER BY s.created_at DESC LIMIT 1
         ) sk ON true
         WHERE ${w} AND sk.kategori_risiko = 'berisiko'
           AND NOT EXISTS (
             SELECT 1 FROM gizi_asesmen a WHERE a.admission_ri_uuid = ri.uuid AND a.faskes_uuid = ri.faskes_uuid
               AND a.deleted_at IS NULL AND a.created_at >= sk.created_at
           )
         ORDER BY sk.waktu_skrining`,
      p,
    );
    kirim(res, rows);
  }),
);

// Riwayat asesmen satu episode; episode yang sudah pulang tetap dapat dibaca (menulis hanya untuk episode aktif).
rute.get(
  "/rawat-inap/:admission_ri_uuid/asesmen",
  izinGizi("Asesmen Gizi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await episodeAktif(f, req.params.admission_ri_uuid, { termasukPulang: true });
    const rows = await query(
      `SELECT * FROM gizi_asesmen WHERE faskes_uuid = $1 AND admission_ri_uuid = $2 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [f, req.params.admission_ri_uuid],
    );
    kirim(res, rows);
  }),
);

rute.post(
  "/rawat-inap/:admission_ri_uuid/asesmen",
  izinGizi("Asesmen Gizi", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const episode = await episodeAktif(f, req.params.admission_ri_uuid);
    wajib(req.body, ["asesmen", "diagnosis_gizi", "intervensi"]);
    const skrining = await skriningTerakhir(f, episode.uuid);
    const r = await sisipkan("gizi_asesmen", {
      faskes_uuid: f,
      admission_ri_uuid: episode.uuid,
      skrining_uuid: skrining?.uuid ?? null,
      ahli_gizi_uuid: req.author.username,
      asesmen: teks(req.body.asesmen),
      diagnosis_gizi: teks(req.body.diagnosis_gizi),
      intervensi: teks(req.body.intervensi),
      monitoring_evaluasi: teks(req.body.monitoring_evaluasi),
      dibuat_oleh: req.author.username,
    });
    kirim(res, r, "Asesmen gizi berhasil disimpan");
  }),
);

rute.put(
  "/asesmen/:uuid",
  izinGizi("Asesmen Gizi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const lama = await satu(`SELECT admission_ri_uuid FROM gizi_asesmen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      req.params.uuid,
      f,
    ]);
    if (!lama) throw tidakDitemukan("Asesmen gizi");
    await episodeAktif(f, lama.admission_ri_uuid); // episode sudah pulang: hanya baca
    const perubahan = {
      asesmen: teks(req.body.asesmen),
      diagnosis_gizi: teks(req.body.diagnosis_gizi),
      intervensi: teks(req.body.intervensi),
      monitoring_evaluasi: teks(req.body.monitoring_evaluasi),
      diubah_oleh: req.author.username,
    };
    const r = await ubah("gizi_asesmen", req.params.uuid, f, perubahan);
    if (!r) throw tidakDitemukan("Asesmen gizi");
    kirim(res, r, "Asesmen gizi berhasil diperbarui");
  }),
);

export default rute;
