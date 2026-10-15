import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { ramah, konflik, tanggalValid } from "./bersama.js";
import { izinMcu } from "../umum/izin.js";

// Datamaster Perusahaan / instansi klien MCU korporasi (rombongan karyawan, tagihan via invoice).
const rute = express.Router();

const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
const KOLOM = (b) => {
  if (b.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email).trim())) throw permintaanSalah("email tidak valid");
  return {
    kode: b.kode === undefined ? undefined : String(b.kode).trim().toUpperCase(),
    nama: b.nama === undefined ? undefined : String(b.nama).trim(),
    alamat: teks(b.alamat),
    pic: teks(b.pic),
    telepon: teks(b.telepon),
    email: teks(b.email),
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
};

const PILIH = `p.uuid, p.kode, p.nama, p.alamat, p.pic, p.telepon, p.email, p.status, p.created_at, p.updated_at,
  (SELECT COUNT(*)::int FROM mcu_peserta s WHERE s.perusahaan_uuid = p.uuid AND s.status <> 'batal' AND s.deleted_at IS NULL) AS jumlah_peserta`;

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (p.kode ILIKE $${p.length} OR p.nama ILIKE $${p.length} OR p.pic ILIKE $${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND p.status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM mcu_perusahaan p WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM mcu_perusahaan p WHERE ${w} ORDER BY p.nama LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const r = await satu(`SELECT ${PILIH} FROM mcu_perusahaan p WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL`, [
      req.params.uuid,
      req.author.faskesUuid,
    ]);
    if (!r) throw tidakDitemukan("Perusahaan");
    kirim(res, r);
  }),
);

rute.post(
  "/",
  izinMcu("Datamaster", "CREATE", "Perusahaan"),
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama"]);
    const r = await sisipkan("mcu_perusahaan", { faskes_uuid: req.author.faskesUuid, ...KOLOM(req.body), status: req.body.status ?? true }).catch((e) =>
      ramah(e, `Kode perusahaan ${req.body.kode} sudah dipakai`),
    );
    kirim(res, r, "Perusahaan berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  izinMcu("Datamaster", "UPDATE", "Perusahaan"),
  tangani(async (req, res) => {
    const r = await ubah("mcu_perusahaan", req.params.uuid, req.author.faskesUuid, KOLOM(req.body)).catch((e) =>
      ramah(e, `Kode perusahaan ${req.body.kode} sudah dipakai`),
    );
    if (!r) throw tidakDitemukan("Perusahaan");
    kirim(res, r, "Perusahaan berhasil diperbarui");
  }),
);

// Hapus lunak; ditolak bila masih ada peserta aktif yang belum ditagihkan.
rute.delete(
  "/:uuid",
  izinMcu("Datamaster", "DELETE", "Perusahaan"),
  tangani(async (req, res) => {
    const aktif = await satu(
      `SELECT COUNT(*)::int n FROM mcu_peserta WHERE perusahaan_uuid = $1 AND faskes_uuid = $2 AND status IN ('terdaftar','proses')
          AND deleted_at IS NULL`,
      [req.params.uuid, req.author.faskesUuid],
    );
    if (aktif.n > 0) throw konflik(`Perusahaan masih memiliki ${aktif.n} peserta MCU yang sedang berjalan`);
    const r = await ubah("mcu_perusahaan", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Perusahaan");
    kirim(res, { uuid: r.uuid }, "Perusahaan berhasil dihapus");
  }),
);

// ── Harga kontrak per perusahaan ─────────────────────────────────────────────
// Harga paket khusus perusahaan dengan masa berlaku opsional. Pendaftaran korporasi memakai harga kontrak yang
// berlaku pada tanggal MCU; bila tidak ada, harga paket. Masa berlaku kontrak aktif untuk paket yang sama tidak boleh
// bertumpang tindih.
const PILIH_KONTRAK = `h.uuid, h.perusahaan_uuid, h.paket_uuid, h.harga::float8 AS harga, h.berlaku_mulai::text AS berlaku_mulai,
  h.berlaku_sampai::text AS berlaku_sampai, h.no_kontrak, h.catatan, h.status, h.dibuat_oleh, h.created_at, h.updated_at,
  pk.kode AS kode_paket, pk.nama AS nama_paket, pk.harga::float8 AS harga_paket,
  (h.status AND (h.berlaku_mulai IS NULL OR h.berlaku_mulai <= (now() AT TIME ZONE 'Asia/Jakarta')::date)
             AND (h.berlaku_sampai IS NULL OR h.berlaku_sampai >= (now() AT TIME ZONE 'Asia/Jakarta')::date)) AS berlaku_hari_ini`;

const ambilKontrak = (uuid, f) =>
  satu(`SELECT ${PILIH_KONTRAK} FROM mcu_harga_kontrak h JOIN mcu_paket pk ON pk.uuid = h.paket_uuid
         WHERE h.uuid = $1 AND h.faskes_uuid = $2 AND h.deleted_at IS NULL`, [uuid, f]);

const kolomKontrak = (b) => {
  const tgl = (v, nama) => (v === undefined ? undefined : v === null || v === "" ? null : tanggalValid(String(v).substring(0, 10), nama));
  const hasil = {
    paket_uuid: b.paket_uuid,
    harga: b.harga === undefined ? undefined : Number(b.harga),
    berlaku_mulai: tgl(b.berlaku_mulai, "berlaku_mulai"),
    berlaku_sampai: tgl(b.berlaku_sampai, "berlaku_sampai"),
    no_kontrak: b.no_kontrak === undefined ? undefined : String(b.no_kontrak ?? "").trim() || null,
    catatan: b.catatan === undefined ? undefined : String(b.catatan ?? "").trim() || null,
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
  if (hasil.harga !== undefined && (!Number.isFinite(hasil.harga) || hasil.harga < 0)) throw permintaanSalah("harga tidak valid");
  return hasil;
};

const cekTumpang = async (f, perusahaanUuid, data, kecuali = null) => {
  if (!data.status) return;
  const bentrok = await satu(
    `SELECT h.no_kontrak, h.berlaku_mulai::text AS mulai, h.berlaku_sampai::text AS sampai FROM mcu_harga_kontrak h
      WHERE h.faskes_uuid = $1 AND h.perusahaan_uuid = $2 AND h.paket_uuid = $3 AND h.status AND h.deleted_at IS NULL
        AND ($4::varchar IS NULL OR h.uuid <> $4)
        AND COALESCE(h.berlaku_mulai, '-infinity'::date) <= COALESCE($6::date, 'infinity'::date)
        AND COALESCE(h.berlaku_sampai, 'infinity'::date) >= COALESCE($5::date, '-infinity'::date)
      LIMIT 1`,
    [f, perusahaanUuid, data.paket_uuid, kecuali, data.berlaku_mulai ?? null, data.berlaku_sampai ?? null],
  );
  if (bentrok)
    throw konflik(
      `Masa berlaku bertumpang tindih dengan kontrak lain untuk paket yang sama (${bentrok.mulai ?? "awal"} s.d. ${bentrok.sampai ?? "seterusnya"}${bentrok.no_kontrak ? `, ${bentrok.no_kontrak}` : ""})`,
    );
};

rute.get(
  "/:uuid/harga-kontrak",
  tangani(async (req, res) => {
    const rows = await query(
      `SELECT ${PILIH_KONTRAK} FROM mcu_harga_kontrak h JOIN mcu_paket pk ON pk.uuid = h.paket_uuid
        WHERE h.perusahaan_uuid = $1 AND h.faskes_uuid = $2 AND h.deleted_at IS NULL
        ORDER BY pk.nama, h.berlaku_mulai DESC NULLS LAST`,
      [req.params.uuid, req.author.faskesUuid],
    );
    kirim(res, rows);
  }),
);

rute.post(
  "/:uuid/harga-kontrak",
  izinMcu("Datamaster", "UPDATE", "Perusahaan"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["paket_uuid", "harga"]);
    const prs = await satu(`SELECT uuid FROM mcu_perusahaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f]);
    if (!prs) throw tidakDitemukan("Perusahaan");
    const pk = await satu(`SELECT uuid FROM mcu_paket WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.body.paket_uuid, f]);
    if (!pk) throw tidakDitemukan("Paket MCU");
    const data = { ...kolomKontrak(req.body), status: req.body.status ?? true };
    if (data.berlaku_mulai && data.berlaku_sampai && data.berlaku_mulai > data.berlaku_sampai) throw permintaanSalah("berlaku_mulai harus sebelum berlaku_sampai");
    await cekTumpang(f, prs.uuid, data);
    const r = await sisipkan("mcu_harga_kontrak", { faskes_uuid: f, perusahaan_uuid: prs.uuid, ...data, dibuat_oleh: req.author.username });
    kirim(res, await ambilKontrak(r.uuid, f), "Harga kontrak berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid/harga-kontrak/:kontrakUuid",
  izinMcu("Datamaster", "UPDATE", "Perusahaan"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const lama = await satu(
      `SELECT *, berlaku_mulai::text AS bm, berlaku_sampai::text AS bs FROM mcu_harga_kontrak
        WHERE uuid = $1 AND perusahaan_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL`,
      [req.params.kontrakUuid, req.params.uuid, f],
    );
    if (!lama) throw tidakDitemukan("Harga kontrak");
    const ubahan = kolomKontrak(req.body);
    const gabung = {
      paket_uuid: ubahan.paket_uuid ?? lama.paket_uuid,
      berlaku_mulai: ubahan.berlaku_mulai === undefined ? lama.bm : ubahan.berlaku_mulai,
      berlaku_sampai: ubahan.berlaku_sampai === undefined ? lama.bs : ubahan.berlaku_sampai,
      status: ubahan.status ?? lama.status,
    };
    if (gabung.berlaku_mulai && gabung.berlaku_sampai && gabung.berlaku_mulai > gabung.berlaku_sampai)
      throw permintaanSalah("berlaku_mulai harus sebelum berlaku_sampai");
    await cekTumpang(f, lama.perusahaan_uuid, gabung, lama.uuid);
    await ubah("mcu_harga_kontrak", lama.uuid, f, ubahan);
    kirim(res, await ambilKontrak(lama.uuid, f), "Harga kontrak berhasil diperbarui");
  }),
);

// Hapus lunak. Peserta yang sudah memakai kontrak tetap menyimpan harga saat pendaftaran.
rute.delete(
  "/:uuid/harga-kontrak/:kontrakUuid",
  izinMcu("Datamaster", "UPDATE", "Perusahaan"),
  tangani(async (req, res) => {
    const r = await satu(
      `UPDATE mcu_harga_kontrak SET deleted_at = $1, updated_at = $1 WHERE uuid = $2 AND perusahaan_uuid = $3 AND faskes_uuid = $4
          AND deleted_at IS NULL RETURNING uuid`,
      [sekarang(), req.params.kontrakUuid, req.params.uuid, req.author.faskesUuid],
    );
    if (!r) throw tidakDitemukan("Harga kontrak");
    kirim(res, r, "Harga kontrak berhasil dihapus");
  }),
);

export default rute;

