import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { alokasiProporsional } from "../alokasi.js";
import { ramah } from "./bersama.js";

// Datamaster Paket Pemeriksaan Radiologi: kumpulan pemeriksaan dengan satu harga paket.
// Saat diorder, paket diekspansi menjadi item order (paket_uuid terisi) dan harga paket dialokasikan
// proporsional terhadap tarif satuan sehingga jumlah harga item = harga paket (lihat ekspansiPaket).
const rute = express.Router();

const PILIH = `pk.uuid, pk.faskes_uuid, pk.kode, pk.nama, pk.deskripsi, pk.harga::float8 AS harga, pk.status, pk.created_at, pk.updated_at`;

// Item paket (beserta tarif satuan saat ini) untuk sejumlah paket.
const itemPaket = (paketUuids, k) =>
  query(
    `SELECT pi.paket_uuid, pi.pemeriksaan_uuid, pi.urutan, m.kode, m.nama, m.modalitas, m.bagian_tubuh, m.kode_icd9,
            m.harga::float8 AS harga, (m.status AND m.deleted_at IS NULL) AS aktif
       FROM rad_paket_item pi JOIN rad_pemeriksaan m ON m.uuid = pi.pemeriksaan_uuid
      WHERE pi.paket_uuid = ANY($1) AND pi.deleted_at IS NULL
      ORDER BY pi.urutan, m.nama`,
    [paketUuids],
    k,
  );

const lengkapi = async (rows, k) => {
  if (!rows.length) return rows;
  const items = await itemPaket(rows.map((r) => r.uuid), k);
  return rows.map((r) => {
    const isi = items.filter((i) => i.paket_uuid === r.uuid);
    const totalSatuan = isi.reduce((n, i) => n + Number(i.harga), 0);
    return { ...r, items: isi, jumlah_item: isi.length, total_satuan: totalSatuan, hemat: Math.max(totalSatuan - Number(r.harga), 0) };
  });
};

const ambil = async (uuid, faskesUuid, k) => {
  const r = await satu(`SELECT ${PILIH} FROM rad_paket pk WHERE pk.uuid = $1 AND pk.faskes_uuid = $2 AND pk.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!r) throw tidakDitemukan("Paket radiologi");
  return (await lengkapi([r], k))[0];
};

// Validasi daftar pemeriksaan (uuid string atau { pemeriksaan_uuid }) → uuid unik, urut sesuai input.
const siapkanItem = async (daftar, faskesUuid, k) => {
  if (!Array.isArray(daftar)) throw permintaanSalah("items harus berupa daftar pemeriksaan");
  const uuids = [...new Set(daftar.map((x) => (typeof x === "string" ? x : x?.pemeriksaan_uuid)).filter(Boolean))];
  if (!uuids.length) throw permintaanSalah("Paket minimal berisi satu pemeriksaan");
  const ada = await query(`SELECT uuid FROM rad_pemeriksaan WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuids, faskesUuid], k);
  if (ada.length !== uuids.length) throw permintaanSalah("Sebagian pemeriksaan tidak ditemukan");
  return uuids;
};

const simpanItem = async (paketUuid, uuids, faskesUuid, k) => {
  await query(`DELETE FROM rad_paket_item WHERE paket_uuid = $1`, [paketUuid], k);
  for (const [i, u] of uuids.entries()) {
    await sisipkan("rad_paket_item", { faskes_uuid: faskesUuid, paket_uuid: paketUuid, pemeriksaan_uuid: u, urutan: i + 1 }, k);
  }
};

const KOLOM = (b) => {
  if (b.harga !== undefined && b.harga !== null && (!Number.isFinite(Number(b.harga)) || Number(b.harga) < 0)) throw permintaanSalah("harga tidak valid");
  const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
  return {
    kode: b.kode === undefined ? undefined : String(b.kode).trim(),
    nama: b.nama === undefined ? undefined : String(b.nama).trim(),
    deskripsi: teks(b.deskripsi),
    harga: b.harga === undefined || b.harga === null ? undefined : Math.round(Number(b.harga)),
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
};

// GET /paket?cari=&status=&page=&limit=
rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "pk.faskes_uuid = $1 AND pk.deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (pk.kode ILIKE $${p.length} OR pk.nama ILIKE $${p.length} OR pk.deskripsi ILIKE $${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND pk.status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM rad_paket pk WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM rad_paket pk WHERE ${w} ORDER BY pk.nama LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(await lengkapi(rows), total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => kirim(res, await ambil(req.params.uuid, req.author.faskesUuid))),
);

rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama", "harga"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const uuids = await siapkanItem(req.body.items ?? req.body.pemeriksaan_uuids, f, k);
      const pk = await sisipkan(
        "rad_paket",
        { faskes_uuid: f, ...Object.fromEntries(Object.entries(KOLOM(req.body)).filter(([, v]) => v !== undefined)), status: req.body.status ?? true },
        k,
      ).catch((e) => ramah(e, `Kode paket ${req.body.kode} sudah dipakai`));
      await simpanItem(pk.uuid, uuids, f, k);
      return ambil(pk.uuid, f, k);
    });
    kirim(res, hasil, "Paket radiologi berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const kolom = KOLOM(req.body);
    if (kolom.kode === "" || kolom.nama === "") throw permintaanSalah("kode dan nama tidak boleh kosong");
    const hasil = await transaksi(async (k) => {
      const pk = await ubah("rad_paket", req.params.uuid, f, kolom, k).catch((e) => ramah(e, `Kode paket ${req.body.kode} sudah dipakai`));
      if (!pk) throw tidakDitemukan("Paket radiologi");
      const daftar = req.body.items ?? req.body.pemeriksaan_uuids;
      if (daftar !== undefined) await simpanItem(pk.uuid, await siapkanItem(daftar, f, k), f, k);
      return ambil(pk.uuid, f, k);
    });
    kirim(res, hasil, "Paket radiologi berhasil diperbarui");
  }),
);

// Hapus lunak: item order lama tetap menyimpan paket_uuid & harga alokasinya.
rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const pk = await ubah("rad_paket", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!pk) throw tidakDitemukan("Paket radiologi");
    kirim(res, { uuid: pk.uuid }, "Paket radiologi berhasil dihapus");
  }),
);

// Ekspansi paket → item order { uuid (pemeriksaan), nama, modalitas, harga (alokasi), paket_uuid }.
// Harga paket dialokasikan proporsional terhadap tarif satuan (bilangan bulat, jumlah = harga paket).
export const ekspansiPaket = async (paketUuids, faskesUuid, k) => {
  const uuids = [...new Set((paketUuids ?? []).filter(Boolean))];
  if (!uuids.length) return [];
  const paket = await query(
    `SELECT uuid, nama, harga FROM rad_paket WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL AND status`,
    [uuids, faskesUuid],
    k,
  );
  if (paket.length !== uuids.length) throw permintaanSalah("Sebagian paket radiologi tidak ditemukan atau tidak aktif");
  const items = await itemPaket(uuids, k);
  const hasil = [];
  for (const pk of paket) {
    const isi = items.filter((i) => i.paket_uuid === pk.uuid);
    if (!isi.length) throw permintaanSalah(`Paket ${pk.nama} belum berisi pemeriksaan`);
    if (isi.some((i) => !i.aktif)) throw permintaanSalah(`Paket ${pk.nama} berisi pemeriksaan yang tidak aktif; perbarui paket terlebih dahulu`);
    const harga = alokasiProporsional(pk.harga, isi.map((i) => i.harga));
    isi.forEach((i, n) => hasil.push({ uuid: i.pemeriksaan_uuid, nama: i.nama, modalitas: i.modalitas, harga: harga[n], paket_uuid: pk.uuid }));
  }
  return hasil;
};

export default rute;
