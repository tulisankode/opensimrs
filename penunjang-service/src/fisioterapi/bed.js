import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, Galat } from "../umum/respons.js";
import { ramah } from "./bersama.js";

// Datamaster Bed Ruangan Fisioterapi. Jumlah slot per jam terapi = jumlah bed aktif.
const rute = express.Router();

const KOLOM = (b) => ({
  kode: b.kode?.trim(),
  nama: b.nama?.trim(),
  ruangan: b.ruangan ?? undefined,
  lokasi_uuid: b.lokasi_uuid ?? undefined,
  keterangan: b.keterangan ?? undefined,
  status: b.status === undefined ? undefined : Boolean(b.status),
});

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length} OR ruangan ILIKE $${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM fisio_bed WHERE ${w}`, p)).n;
    const rows = await query(`SELECT * FROM fisio_bed WHERE ${w} ORDER BY ruangan NULLS LAST, kode LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const b = await satu(`SELECT * FROM fisio_bed WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, req.author.faskesUuid]);
    if (!b) throw tidakDitemukan("Bed");
    kirim(res, b);
  }),
);

rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama"]);
    const b = await sisipkan("fisio_bed", { faskes_uuid: req.author.faskesUuid, ...KOLOM(req.body), status: req.body.status ?? true }).catch((e) =>
      ramah(e, `Kode bed ${req.body.kode} sudah dipakai`),
    );
    kirim(res, b, "Bed berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const b = await ubah("fisio_bed", req.params.uuid, req.author.faskesUuid, KOLOM(req.body)).catch((e) => ramah(e, `Kode bed ${req.body.kode} sudah dipakai`));
    if (!b) throw tidakDitemukan("Bed");
    kirim(res, b, "Bed berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const dipakai = await satu(
      `SELECT COUNT(*) n FROM fisio_jadwal WHERE bed_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
          AND status IN ('booking', 'terjadwal', 'hadir') AND tanggal >= CURRENT_DATE`,
      [req.params.uuid, f],
    );
    if (Number(dipakai.n) > 0) throw new Galat(409, `Bed masih memiliki ${dipakai.n} jadwal/booking aktif; batalkan atau pindahkan dahulu`);
    const b = await ubah("fisio_bed", req.params.uuid, f, { deleted_at: sekarang() });
    if (!b) throw tidakDitemukan("Bed");
    kirim(res, b, "Bed berhasil dihapus");
  }),
);

export default rute;
