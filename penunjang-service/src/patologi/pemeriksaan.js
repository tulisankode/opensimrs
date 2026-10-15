import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { JENIS, ramah, daftarNilai } from "./bersama.js";
import { izinPa } from "../umum/izin.js";

// Datamaster Pemeriksaan PA: kode, nama, jenis (histopatologi/sitologi/potong beku/IHK), kategori (mis. biopsi kecil),
// tarif, kode ICD-9-CM, target waktu selesai (TAT, hari kerja).
const rute = express.Router();

const KOLOM = (b) => {
  if (b.jenis !== undefined && !JENIS[b.jenis]) throw permintaanSalah(`jenis harus salah satu: ${Object.keys(JENIS).join(", ")}`);
  if (b.harga !== undefined && b.harga !== null && (!Number.isFinite(Number(b.harga)) || Number(b.harga) < 0)) throw permintaanSalah("harga tidak valid");
  if (b.tat_hari !== undefined && b.tat_hari !== null && (!Number.isInteger(Number(b.tat_hari)) || Number(b.tat_hari) < 0 || Number(b.tat_hari) > 60))
    throw permintaanSalah("tat_hari harus bilangan bulat 0–60");
  const t = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
  return {
    kode: b.kode === undefined ? undefined : String(b.kode).trim(),
    nama: b.nama === undefined ? undefined : String(b.nama).trim(),
    jenis: b.jenis,
    kategori: t(b.kategori),
    kode_icd9: t(b.kode_icd9),
    keterangan: t(b.keterangan),
    harga: b.harga === undefined || b.harga === null ? undefined : Number(b.harga),
    tat_hari: b.tat_hari === undefined || b.tat_hari === null ? undefined : Number(b.tat_hari),
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
};

const PILIH = `uuid, kode, nama, jenis, kategori, harga::float8 AS harga, kode_icd9, tat_hari, keterangan, status, created_at, updated_at`;
const angka = (t) => ({ ...t, harga: Number(t.harga) });

rute.get("/jenis", tangani(async (req, res) => kirim(res, Object.entries(JENIS).map(([kode, j]) => ({ kode, nama: j.label, prefiks: j.prefiks })))));

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length} OR kategori ILIKE $${p.length})`;
    }
    const jenis = daftarNilai(req.query.jenis).filter((j) => JENIS[j]);
    if (jenis.length) {
      p.push(jenis);
      w += ` AND jenis = ANY($${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM pa_pemeriksaan WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM pa_pemeriksaan WHERE ${w}
        ORDER BY array_position(ARRAY['histopatologi','sitologi','potong_beku','ihk']::varchar[], jenis), harga, nama
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await satu(`SELECT ${PILIH} FROM pa_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, req.author.faskesUuid]);
    if (!t) throw tidakDitemukan("Pemeriksaan PA");
    kirim(res, t);
  }),
);

rute.post(
  "/",
  izinPa("Datamaster", "CREATE", "Pemeriksaan PA"),
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama", "jenis"]);
    const t = await sisipkan("pa_pemeriksaan", {
      faskes_uuid: req.author.faskesUuid,
      harga: 0,
      tat_hari: 5,
      ...Object.fromEntries(Object.entries(KOLOM(req.body)).filter(([, v]) => v !== undefined)),
      status: req.body.status ?? true,
    }).catch((e) => ramah(e, `Kode pemeriksaan ${req.body.kode} sudah dipakai`));
    kirim(res, angka(t), "Pemeriksaan PA berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  izinPa("Datamaster", "UPDATE", "Pemeriksaan PA"),
  tangani(async (req, res) => {
    const kolom = KOLOM(req.body);
    if (kolom.kode === "" || kolom.nama === "") throw permintaanSalah("kode dan nama tidak boleh kosong");
    const t = await ubah("pa_pemeriksaan", req.params.uuid, req.author.faskesUuid, kolom).catch((e) => ramah(e, `Kode pemeriksaan ${req.body.kode} sudah dipakai`));
    if (!t) throw tidakDitemukan("Pemeriksaan PA");
    kirim(res, angka(t), "Pemeriksaan PA berhasil diperbarui");
  }),
);

// Hapus lunak: order lama tetap menyimpan nama, jenis & tarif (snapshot) di pa_order_item.
rute.delete(
  "/:uuid",
  izinPa("Datamaster", "DELETE", "Pemeriksaan PA"),
  tangani(async (req, res) => {
    const t = await ubah("pa_pemeriksaan", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Pemeriksaan PA");
    kirim(res, { uuid: t.uuid }, "Pemeriksaan PA berhasil dihapus");
  }),
);

export default rute;
