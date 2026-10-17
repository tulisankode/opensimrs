import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinGizi } from "../umum/izin.js";
import { ramah, konflik, teks } from "./bersama.js";

// Datamaster Gizi: Master Diet, Bentuk Makanan, dan Standar Porsi (kombinasi diet × bentuk makanan).
const rute = express.Router();

const filterStatus = (p, w, kolomAlias, status) => {
  if (status === undefined || status === "") return w;
  p.push(["1", "true", "aktif"].includes(String(status)));
  return `${w} AND ${kolomAlias}.status = $${p.length}`;
};

// ── Master Diet ──────────────────────────────────────────────────────────────
rute.get(
  "/diet",
  izinGizi("Datamaster", "READ", "Master Diet"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "d.faskes_uuid = $1 AND d.deleted_at IS NULL";
    w = filterStatus(p, w, "d", req.query.status);
    if (req.query.q) {
      p.push(`%${req.query.q}%`);
      w += ` AND (d.kode ILIKE $${p.length} OR d.nama_diet ILIKE $${p.length})`;
    }
    kirim(res, await query(`SELECT d.* FROM gizi_master_diet d WHERE ${w} ORDER BY d.nama_diet`, p));
  }),
);

rute.post(
  "/diet",
  izinGizi("Datamaster", "CREATE", "Master Diet"),
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama_diet"]);
    const r = await sisipkan("gizi_master_diet", {
      faskes_uuid: req.author.faskesUuid,
      kode: String(req.body.kode).trim().toUpperCase(),
      nama_diet: String(req.body.nama_diet).trim(),
      deskripsi: teks(req.body.deskripsi),
      status: req.body.status ?? true,
    }).catch((e) => ramah(e, `Kode diet ${req.body.kode} sudah dipakai`));
    kirim(res, r, "Master diet berhasil ditambahkan");
  }),
);

rute.put(
  "/diet/:uuid",
  izinGizi("Datamaster", "UPDATE", "Master Diet"),
  tangani(async (req, res) => {
    const perubahan = {
      kode: req.body.kode === undefined ? undefined : String(req.body.kode).trim().toUpperCase(),
      nama_diet: req.body.nama_diet === undefined ? undefined : String(req.body.nama_diet).trim(),
      deskripsi: teks(req.body.deskripsi),
      status: req.body.status === undefined ? undefined : Boolean(req.body.status),
    };
    const r = await ubah("gizi_master_diet", req.params.uuid, req.author.faskesUuid, perubahan).catch((e) =>
      ramah(e, `Kode diet ${req.body.kode} sudah dipakai`),
    );
    if (!r) throw tidakDitemukan("Master diet");
    kirim(res, r, "Master diet berhasil diperbarui");
  }),
);

rute.delete(
  "/diet/:uuid",
  izinGizi("Datamaster", "DELETE", "Master Diet"),
  tangani(async (req, res) => {
    const dipakai = await satu(
      `SELECT COUNT(*)::int n FROM gizi_order_diet WHERE diet_uuid = $1 AND faskes_uuid = $2 AND status = 'aktif' AND deleted_at IS NULL`,
      [req.params.uuid, req.author.faskesUuid],
    );
    if (dipakai.n > 0) throw konflik(`Diet masih dipakai pada ${dipakai.n} order diet aktif`);
    const r = await ubah("gizi_master_diet", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Master diet");
    kirim(res, { uuid: r.uuid }, "Master diet berhasil dihapus");
  }),
);

// ── Bentuk Makanan ────────────────────────────────────────────────────────────
rute.get(
  "/bentuk-makanan",
  izinGizi("Datamaster", "READ", "Bentuk Makanan"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "b.faskes_uuid = $1 AND b.deleted_at IS NULL";
    w = filterStatus(p, w, "b", req.query.status);
    kirim(res, await query(`SELECT b.* FROM gizi_master_bentuk_makanan b WHERE ${w} ORDER BY b.nama`, p));
  }),
);

rute.post(
  "/bentuk-makanan",
  izinGizi("Datamaster", "CREATE", "Bentuk Makanan"),
  tangani(async (req, res) => {
    wajib(req.body, ["nama"]);
    const r = await sisipkan("gizi_master_bentuk_makanan", {
      faskes_uuid: req.author.faskesUuid,
      nama: String(req.body.nama).trim(),
      status: req.body.status ?? true,
    }).catch((e) => ramah(e, `Bentuk makanan "${req.body.nama}" sudah ada`));
    kirim(res, r, "Bentuk makanan berhasil ditambahkan");
  }),
);

rute.put(
  "/bentuk-makanan/:uuid",
  izinGizi("Datamaster", "UPDATE", "Bentuk Makanan"),
  tangani(async (req, res) => {
    const perubahan = {
      nama: req.body.nama === undefined ? undefined : String(req.body.nama).trim(),
      status: req.body.status === undefined ? undefined : Boolean(req.body.status),
    };
    const r = await ubah("gizi_master_bentuk_makanan", req.params.uuid, req.author.faskesUuid, perubahan).catch((e) =>
      ramah(e, `Bentuk makanan "${req.body.nama}" sudah ada`),
    );
    if (!r) throw tidakDitemukan("Bentuk makanan");
    kirim(res, r, "Bentuk makanan berhasil diperbarui");
  }),
);

rute.delete(
  "/bentuk-makanan/:uuid",
  izinGizi("Datamaster", "DELETE", "Bentuk Makanan"),
  tangani(async (req, res) => {
    const dipakai = await satu(
      `SELECT COUNT(*)::int n FROM gizi_order_diet WHERE bentuk_makanan_uuid = $1 AND faskes_uuid = $2 AND status = 'aktif' AND deleted_at IS NULL`,
      [req.params.uuid, req.author.faskesUuid],
    );
    if (dipakai.n > 0) throw konflik(`Bentuk makanan masih dipakai pada ${dipakai.n} order diet aktif`);
    const r = await ubah("gizi_master_bentuk_makanan", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Bentuk makanan");
    kirim(res, { uuid: r.uuid }, "Bentuk makanan berhasil dihapus");
  }),
);

// ── Standar Porsi (kombinasi diet × bentuk makanan) ──────────────────────────
const PILIH_PORSI = `sp.uuid, sp.faskes_uuid, sp.diet_uuid, sp.bentuk_makanan_uuid, sp.takaran, sp.satuan,
  sp.created_at, sp.updated_at, d.nama_diet, b.nama AS nama_bentuk_makanan`;

rute.get(
  "/standar-porsi",
  izinGizi("Datamaster", "READ", "Standar Porsi"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "sp.faskes_uuid = $1 AND sp.deleted_at IS NULL";
    if (req.query.diet_uuid) {
      p.push(req.query.diet_uuid);
      w += ` AND sp.diet_uuid = $${p.length}`;
    }
    if (req.query.bentuk_makanan_uuid) {
      p.push(req.query.bentuk_makanan_uuid);
      w += ` AND sp.bentuk_makanan_uuid = $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT ${PILIH_PORSI} FROM gizi_master_standar_porsi sp
           JOIN gizi_master_diet d ON d.uuid = sp.diet_uuid JOIN gizi_master_bentuk_makanan b ON b.uuid = sp.bentuk_makanan_uuid
          WHERE ${w} ORDER BY d.nama_diet, b.nama`,
        p,
      ),
    );
  }),
);

rute.post(
  "/standar-porsi",
  izinGizi("Datamaster", "CREATE", "Standar Porsi"),
  tangani(async (req, res) => {
    wajib(req.body, ["diet_uuid", "bentuk_makanan_uuid", "takaran"]);
    const f = req.author.faskesUuid;
    const diet = await satu(`SELECT uuid FROM gizi_master_diet WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      req.body.diet_uuid,
      f,
    ]);
    if (!diet) throw permintaanSalah("Master diet tidak ditemukan");
    const bentuk = await satu(`SELECT uuid FROM gizi_master_bentuk_makanan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      req.body.bentuk_makanan_uuid,
      f,
    ]);
    if (!bentuk) throw permintaanSalah("Bentuk makanan tidak ditemukan");
    const r = await sisipkan("gizi_master_standar_porsi", {
      faskes_uuid: f,
      diet_uuid: req.body.diet_uuid,
      bentuk_makanan_uuid: req.body.bentuk_makanan_uuid,
      takaran: String(req.body.takaran).trim(),
      satuan: teks(req.body.satuan),
    }).catch((e) => ramah(e, "Standar porsi untuk kombinasi diet & bentuk makanan ini sudah ada"));
    kirim(res, r, "Standar porsi berhasil ditambahkan");
  }),
);

rute.put(
  "/standar-porsi/:uuid",
  izinGizi("Datamaster", "UPDATE", "Standar Porsi"),
  tangani(async (req, res) => {
    const perubahan = {
      takaran: req.body.takaran === undefined ? undefined : String(req.body.takaran).trim(),
      satuan: teks(req.body.satuan),
    };
    const r = await ubah("gizi_master_standar_porsi", req.params.uuid, req.author.faskesUuid, perubahan);
    if (!r) throw tidakDitemukan("Standar porsi");
    kirim(res, r, "Standar porsi berhasil diperbarui");
  }),
);

rute.delete(
  "/standar-porsi/:uuid",
  izinGizi("Datamaster", "DELETE", "Standar Porsi"),
  tangani(async (req, res) => {
    const r = await ubah("gizi_master_standar_porsi", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Standar porsi");
    kirim(res, { uuid: r.uuid }, "Standar porsi berhasil dihapus");
  }),
);

export default rute;
