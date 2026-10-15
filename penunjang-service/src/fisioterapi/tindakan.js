import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { ramah, JENIS_FISIO } from "./bersama.js";

// Datamaster Tindakan Terapi (tarif fisioterapi). jenis_fisio opsional: kosong = berlaku untuk semua jenis.
const rute = express.Router();

const KOLOM = (b) => {
  if (b.jenis_fisio && !JENIS_FISIO.includes(b.jenis_fisio)) throw permintaanSalah(`jenis_fisio harus salah satu: ${JENIS_FISIO.join(", ")}`);
  if (b.harga !== undefined && (!Number.isFinite(Number(b.harga)) || Number(b.harga) < 0)) throw permintaanSalah("harga tidak valid");
  return {
    kode: b.kode?.trim(),
    nama: b.nama?.trim(),
    harga: b.harga === undefined ? undefined : Number(b.harga),
    jenis_fisio: b.jenis_fisio === undefined ? undefined : b.jenis_fisio || null,
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
};

const PILIH = `uuid, faskes_uuid, kode, nama, harga::float8 AS harga, jenis_fisio, status, created_at, updated_at`;

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length})`;
    }
    if (req.query.jenis_fisio) {
      p.push(req.query.jenis_fisio);
      w += ` AND (jenis_fisio IS NULL OR jenis_fisio = $${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM fisio_tindakan WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM fisio_tindakan WHERE ${w} ORDER BY nama LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await satu(`SELECT ${PILIH} FROM fisio_tindakan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, req.author.faskesUuid]);
    if (!t) throw tidakDitemukan("Tindakan terapi");
    kirim(res, t);
  }),
);

rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama"]);
    const t = await sisipkan("fisio_tindakan", { faskes_uuid: req.author.faskesUuid, harga: 0, ...KOLOM(req.body), status: req.body.status ?? true }).catch((e) =>
      ramah(e, `Kode tindakan ${req.body.kode} sudah dipakai`),
    );
    kirim(res, { ...t, harga: Number(t.harga) }, "Tindakan terapi berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await ubah("fisio_tindakan", req.params.uuid, req.author.faskesUuid, KOLOM(req.body)).catch((e) =>
      ramah(e, `Kode tindakan ${req.body.kode} sudah dipakai`),
    );
    if (!t) throw tidakDitemukan("Tindakan terapi");
    kirim(res, { ...t, harga: Number(t.harga) }, "Tindakan terapi berhasil diperbarui");
  }),
);

// Hapus lunak: order lama tetap menyimpan nama & harga (snapshot) di fisio_order_tindakan.
rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await ubah("fisio_tindakan", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Tindakan terapi");
    kirim(res, { uuid: t.uuid }, "Tindakan terapi berhasil dihapus");
  }),
);

export default rute;
