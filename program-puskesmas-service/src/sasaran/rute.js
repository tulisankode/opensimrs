import express from "express";
import { query, satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinProgramPuskesmas } from "../umum/izin.js";
import { pastikanKelurahan } from "../umum/kunjungan.js";

// Sasaran Program — /api/v3/program-puskesmas/sasaran (KF-15..KF-17)
const rute = express.Router();

const JENIS = ["ibu_hamil", "bayi", "balita"];

rute.get(
  "/",
  izinProgramPuskesmas("Sasaran Program", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "s.faskes_uuid = $1 AND s.deleted_at IS NULL";
    if (req.query.jenis_sasaran) {
      p.push(req.query.jenis_sasaran);
      w += ` AND s.jenis_sasaran = $${p.length}`;
    }
    if (req.query.periode) {
      p.push(req.query.periode);
      w += ` AND s.periode = $${p.length}`;
    }
    if (req.query.kelurahan_code) {
      p.push(req.query.kelurahan_code);
      w += ` AND s.kelurahan_code = $${p.length}`;
    }
    if (req.query.status) {
      p.push(req.query.status);
      w += ` AND s.status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM program_sasaran s WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT s.*, k.name AS nama_kelurahan, p.name AS nama_pasien, p.no_rm
         FROM program_sasaran s JOIN kelurahan k ON k.code = s.kelurahan_code
         LEFT JOIN patients p ON p.uuid = s.patient_uuid
        WHERE ${w} ORDER BY s.periode DESC, s.status LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Ringkasan cakupan per kelurahan & periode (dipantau kepala puskesmas).
rute.get(
  "/ringkasan",
  izinProgramPuskesmas("Sasaran Program", "READ"),
  tangani(async (req, res) => {
    wajib(req.query, ["periode"]);
    const rows = await query(
      `SELECT s.kelurahan_code, k.name AS nama_kelurahan, s.jenis_sasaran,
              COUNT(*)::int AS jumlah_sasaran,
              COUNT(*) FILTER (WHERE s.status = 'sudah_dilayani')::int AS jumlah_dilayani
         FROM program_sasaran s JOIN kelurahan k ON k.code = s.kelurahan_code
        WHERE s.faskes_uuid = $1 AND s.deleted_at IS NULL AND s.periode = $2
        GROUP BY s.kelurahan_code, k.name, s.jenis_sasaran ORDER BY k.name, s.jenis_sasaran`,
      [req.author.faskesUuid, req.query.periode],
    );
    kirim(res, rows);
  }),
);

rute.post(
  "/",
  izinProgramPuskesmas("Sasaran Program", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["jenis_sasaran", "kelurahan_code", "periode"]);
    if (!JENIS.includes(req.body.jenis_sasaran)) throw permintaanSalah(`jenis_sasaran harus salah satu dari ${JENIS.join(", ")}`);
    if (!/^\d{4}-\d{2}$/.test(req.body.periode)) throw permintaanSalah("periode harus format YYYY-MM");
    await pastikanKelurahan(req.body.kelurahan_code);
    const r = await sisipkan("program_sasaran", {
      faskes_uuid: f, jenis_sasaran: req.body.jenis_sasaran, patient_uuid: req.body.patient_uuid ?? null,
      kelurahan_code: req.body.kelurahan_code, periode: req.body.periode,
      status: req.body.status ?? "belum_dilayani", keterangan: req.body.keterangan ?? null,
      dibuat_oleh: req.author.username,
    });
    kirim(res, r, "Sasaran program berhasil disimpan");
  }),
);

rute.put(
  "/:uuid",
  izinProgramPuskesmas("Sasaran Program", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    if (b.status && !["belum_dilayani", "sudah_dilayani"].includes(b.status)) throw permintaanSalah("status tidak valid");
    const r = await ubah("program_sasaran", req.params.uuid, req.author.faskesUuid, { status: b.status, keterangan: b.keterangan });
    if (!r) throw tidakDitemukan("Sasaran program");
    kirim(res, r, "Sasaran program berhasil diperbarui");
  }),
);

export default rute;
