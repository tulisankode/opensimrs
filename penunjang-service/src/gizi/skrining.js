import express from "express";
import { query, satu, sisipkan, sekarang } from "../db.js";
import { tangani, kirim, tidakDitemukan } from "../umum/respons.js";
import { izinGizi } from "../umum/izin.js";
import { hitungSkor } from "./bersama.js";
import { episodeAktif, daftarAktif } from "./rawat_inap.js";

const SATU_HARI = 86400;

const rute = express.Router();

// Skrining paling baru (bila ada) untuk satu episode rawat inap.
const skriningTerakhir = (faskesUuid, admissionRiUuid) =>
  satu(
    `SELECT * FROM gizi_skrining WHERE faskes_uuid = $1 AND admission_ri_uuid = $2 AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [faskesUuid, admissionRiUuid],
  );

// Pasien rawat inap aktif yang belum punya skrining gizi sama sekali, beserta batas waktu 1x24 jam sejak masuk.
rute.get(
  "/rawat-inap/belum-skrining",
  izinGizi("Skrining", "READ"),
  tangani(async (req, res) => {
    const aktif = await daftarAktif(req.author.faskesUuid, { ruanganUuid: req.query.ruangan_uuid, cari: req.query.cari });
    const sudah = new Set(
      (
        await query(`SELECT DISTINCT admission_ri_uuid FROM gizi_skrining WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [
          req.author.faskesUuid,
        ])
      ).map((r) => r.admission_ri_uuid),
    );
    const belum = aktif
      .filter((p) => !sudah.has(p.uuid))
      .map((p) => {
        const batas = Number(p.tanggal_dirawat ?? 0) + SATU_HARI;
        return { ...p, batas_waktu_skrining: batas, terlambat: Math.floor(Date.now() / 1000) > batas };
      });
    kirim(res, belum);
  }),
);

rute.get(
  "/skrining/:uuid",
  izinGizi("Skrining", "READ"),
  tangani(async (req, res) => {
    const r = await satu(`SELECT * FROM gizi_skrining WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      req.params.uuid,
      req.author.faskesUuid,
    ]);
    if (!r) throw tidakDitemukan("Skrining gizi");
    kirim(res, r);
  }),
);

// Body: { instrumen: 'mst'|'nrs2002', jawaban: [{ kode, nilai }], waktu_skrining? }. Skor dihitung di server dari
// definisi pertanyaan (INSTRUMEN) agar tidak bisa dimanipulasi dari klien.
rute.post(
  "/rawat-inap/:admission_ri_uuid/skrining",
  izinGizi("Skrining", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const episode = await episodeAktif(f, req.params.admission_ri_uuid);
    const { jawaban, skor, kategoriRisiko: kategori } = hitungSkor(req.body?.instrumen, req.body?.jawaban);
    const r = await sisipkan("gizi_skrining", {
      faskes_uuid: f,
      admission_ri_uuid: episode.uuid,
      instrumen: req.body.instrumen,
      jawaban,
      skor,
      kategori_risiko: kategori,
      petugas: req.author.username,
      waktu_skrining: req.body.waktu_skrining ? Number(req.body.waktu_skrining) : sekarang(),
    });
    kirim(res, r, "Skrining gizi berhasil disimpan");
  }),
);

export default rute;
export { skriningTerakhir };
