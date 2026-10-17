import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinProgramPuskesmas } from "../umum/izin.js";
import { pastikanKelurahan } from "../umum/kunjungan.js";

// Kegiatan UKM & luar gedung — /api/v3/program-puskesmas/ukm/kegiatan (KF-18/KF-19)
const rute = express.Router();

const JENIS = ["posyandu", "penyuluhan", "kesling", "lainnya"];

const KOLOM = (b) => ({
  jenis_kegiatan: b.jenis_kegiatan,
  kelurahan_code: b.kelurahan_code,
  tanggal_pelaksanaan: b.tanggal_pelaksanaan,
  pelaksana: b.pelaksana ?? null,
  jumlah_sasaran: b.jumlah_sasaran === undefined ? undefined : Number(b.jumlah_sasaran) || 0,
  capaian: b.capaian === undefined ? undefined : b.capaian ?? {},
  catatan: b.catatan ?? null,
});

rute.get(
  "/kegiatan",
  izinProgramPuskesmas("Kegiatan UKM", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "u.faskes_uuid = $1 AND u.deleted_at IS NULL";
    if (req.query.kelurahan_code) {
      p.push(req.query.kelurahan_code);
      w += ` AND u.kelurahan_code = $${p.length}`;
    }
    if (req.query.jenis_kegiatan) {
      p.push(req.query.jenis_kegiatan);
      w += ` AND u.jenis_kegiatan = $${p.length}`;
    }
    if (req.query.periode) {
      p.push(`${req.query.periode}%`);
      w += ` AND u.tanggal_pelaksanaan::text LIKE $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ukm_kegiatan u WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT u.*, k.name AS nama_kelurahan FROM ukm_kegiatan u JOIN kelurahan k ON k.code = u.kelurahan_code
        WHERE ${w} ORDER BY u.tanggal_pelaksanaan DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Ringkasan capaian per kelurahan & periode (bukan jumlah pasien unik — aturan bisnis #10).
rute.get(
  "/ringkasan",
  izinProgramPuskesmas("Kegiatan UKM", "READ"),
  tangani(async (req, res) => {
    wajib(req.query, ["periode"]);
    const rows = await query(
      `SELECT kelurahan_code, k.name AS nama_kelurahan, jenis_kegiatan, COUNT(*)::int AS jumlah_kegiatan,
              COALESCE(SUM(jumlah_sasaran), 0)::int AS total_peserta
         FROM ukm_kegiatan u JOIN kelurahan k ON k.code = u.kelurahan_code
        WHERE u.faskes_uuid = $1 AND u.deleted_at IS NULL AND u.tanggal_pelaksanaan::text LIKE $2
        GROUP BY kelurahan_code, k.name, jenis_kegiatan ORDER BY k.name, jenis_kegiatan`,
      [req.author.faskesUuid, `${req.query.periode}%`],
    );
    kirim(res, rows);
  }),
);

rute.post(
  "/kegiatan",
  izinProgramPuskesmas("Kegiatan UKM", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["jenis_kegiatan", "kelurahan_code", "tanggal_pelaksanaan"]);
    if (!JENIS.includes(req.body.jenis_kegiatan)) throw permintaanSalah(`jenis_kegiatan harus salah satu dari ${JENIS.join(", ")}`);
    await pastikanKelurahan(req.body.kelurahan_code);
    const r = await sisipkan("ukm_kegiatan", { faskes_uuid: f, ...KOLOM(req.body), dibuat_oleh: req.author.username });
    kirim(res, r, "Kegiatan UKM berhasil disimpan");
  }),
);

rute.put(
  "/kegiatan/:uuid",
  izinProgramPuskesmas("Kegiatan UKM", "UPDATE"),
  tangani(async (req, res) => {
    const r = await ubah("ukm_kegiatan", req.params.uuid, req.author.faskesUuid, KOLOM(req.body));
    if (!r) throw tidakDitemukan("Kegiatan UKM");
    kirim(res, r, "Kegiatan UKM berhasil diperbarui");
  }),
);

rute.delete(
  "/kegiatan/:uuid",
  izinProgramPuskesmas("Kegiatan UKM", "DELETE"),
  tangani(async (req, res) => {
    const r = await ubah("ukm_kegiatan", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Kegiatan UKM");
    kirim(res, { uuid: r.uuid }, "Kegiatan UKM berhasil dihapus");
  }),
);

export default rute;
