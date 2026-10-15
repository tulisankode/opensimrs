import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { alokasiProporsional } from "../alokasi.js";
import { ramah, JENIS_FISIO, jenisValid } from "./bersama.js";

// Datamaster Paket Terapi Fisioterapi: tindakan (qty per sesi) + jumlah sesi + harga paket (seluruh sesi).
// Saat diorder (fisio_order.paket_uuid), harga paket dialokasikan ke tindakan pada kolom
// fisio_order_tindakan.nilai_paket (proporsional terhadap tarif × qty; jumlahnya tepat = harga paket).
// Tagihan & laporan pendapatan/tindakan memakai nilai_paket bila ada, sehingga total = harga paket.
const rute = express.Router();

const PILIH = `pk.uuid, pk.faskes_uuid, pk.kode, pk.nama, pk.jenis_fisio, pk.jumlah_sesi, pk.harga::float8 AS harga, pk.deskripsi,
  pk.status, pk.created_at, pk.updated_at`;

const tindakanPaket = (paketUuids, k) =>
  query(
    `SELECT pt.paket_uuid, pt.tindakan_uuid, pt.qty, pt.urutan, m.kode, m.nama, m.jenis_fisio, m.harga::float8 AS harga,
            (m.status AND m.deleted_at IS NULL) AS aktif
       FROM fisio_paket_tindakan pt JOIN fisio_tindakan m ON m.uuid = pt.tindakan_uuid
      WHERE pt.paket_uuid = ANY($1) AND pt.deleted_at IS NULL
      ORDER BY pt.urutan, m.nama`,
    [paketUuids],
    k,
  );

const lengkapi = async (rows, k) => {
  if (!rows.length) return rows;
  const isi = await tindakanPaket(rows.map((r) => r.uuid), k);
  return rows.map((r) => {
    const tindakan = isi.filter((t) => t.paket_uuid === r.uuid);
    const perSesi = tindakan.reduce((n, t) => n + Number(t.harga) * Number(t.qty), 0);
    const totalSatuan = perSesi * Number(r.jumlah_sesi);
    return { ...r, tindakan, jumlah_tindakan: tindakan.length, tarif_per_sesi: perSesi, total_satuan: totalSatuan, hemat: Math.max(totalSatuan - Number(r.harga), 0) };
  });
};

const ambil = async (uuid, faskesUuid, k) => {
  const r = await satu(`SELECT ${PILIH} FROM fisio_paket pk WHERE pk.uuid = $1 AND pk.faskes_uuid = $2 AND pk.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!r) throw tidakDitemukan("Paket fisioterapi");
  return (await lengkapi([r], k))[0];
};

// Daftar tindakan: uuid string atau { tindakan_uuid, qty }. Tindakan sama digabung (qty dijumlah).
const siapkanTindakan = async (daftar, faskesUuid, k) => {
  if (!Array.isArray(daftar)) throw permintaanSalah("tindakan harus berupa daftar");
  const peta = new Map();
  for (const t of daftar) {
    const u = typeof t === "string" ? t : t?.tindakan_uuid ?? t?.uuid;
    if (!u) continue;
    const qty = Math.max(Math.floor(Number(t?.qty) || 1), 1);
    peta.set(u, (peta.get(u) ?? 0) + qty);
  }
  if (!peta.size) throw permintaanSalah("Paket minimal berisi satu tindakan");
  const ada = await query(`SELECT uuid FROM fisio_tindakan WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [[...peta.keys()], faskesUuid], k);
  if (ada.length !== peta.size) throw permintaanSalah("Sebagian tindakan tidak ditemukan");
  return [...peta.entries()].map(([tindakan_uuid, qty]) => ({ tindakan_uuid, qty }));
};

const simpanTindakan = async (paketUuid, daftar, faskesUuid, k) => {
  await query(`DELETE FROM fisio_paket_tindakan WHERE paket_uuid = $1`, [paketUuid], k);
  for (const [i, t] of daftar.entries()) {
    await sisipkan("fisio_paket_tindakan", { faskes_uuid: faskesUuid, paket_uuid: paketUuid, ...t, urutan: i + 1 }, k);
  }
};

const KOLOM = (b) => {
  if (b.harga !== undefined && b.harga !== null && (!Number.isFinite(Number(b.harga)) || Number(b.harga) < 0)) throw permintaanSalah("harga tidak valid");
  if (b.jumlah_sesi !== undefined) {
    const n = Number(b.jumlah_sesi);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw permintaanSalah("jumlah_sesi harus 1 sampai 100");
  }
  const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
  return {
    kode: b.kode === undefined ? undefined : String(b.kode).trim(),
    nama: b.nama === undefined ? undefined : String(b.nama).trim(),
    jenis_fisio: b.jenis_fisio === undefined ? undefined : jenisValid(b.jenis_fisio),
    jumlah_sesi: b.jumlah_sesi === undefined ? undefined : Number(b.jumlah_sesi),
    harga: b.harga === undefined || b.harga === null ? undefined : Math.round(Number(b.harga)),
    deskripsi: teks(b.deskripsi),
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
};

// GET /paket?cari=&jenis_fisio=&status=&page=&limit=
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
    const jenis = String(req.query.jenis_fisio ?? "").split(",").filter((j) => JENIS_FISIO.includes(j));
    if (jenis.length) {
      p.push(jenis);
      w += ` AND pk.jenis_fisio = ANY($${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND pk.status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM fisio_paket pk WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM fisio_paket pk WHERE ${w}
        ORDER BY array_position(ARRAY['sport','saraf','orto','anak','geriatri']::varchar[], pk.jenis_fisio), pk.nama
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
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
    wajib(req.body, ["kode", "nama", "jenis_fisio", "jumlah_sesi", "harga"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const tindakan = await siapkanTindakan(req.body.tindakan, f, k);
      const pk = await sisipkan(
        "fisio_paket",
        { faskes_uuid: f, ...Object.fromEntries(Object.entries(KOLOM(req.body)).filter(([, v]) => v !== undefined)), status: req.body.status ?? true },
        k,
      ).catch((e) => ramah(e, `Kode paket ${req.body.kode} sudah dipakai`));
      await simpanTindakan(pk.uuid, tindakan, f, k);
      return ambil(pk.uuid, f, k);
    });
    kirim(res, hasil, "Paket fisioterapi berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const kolom = KOLOM(req.body);
    if (kolom.kode === "" || kolom.nama === "") throw permintaanSalah("kode dan nama tidak boleh kosong");
    const hasil = await transaksi(async (k) => {
      const pk = await ubah("fisio_paket", req.params.uuid, f, kolom, k).catch((e) => ramah(e, `Kode paket ${req.body.kode} sudah dipakai`));
      if (!pk) throw tidakDitemukan("Paket fisioterapi");
      if (req.body.tindakan !== undefined) await simpanTindakan(pk.uuid, await siapkanTindakan(req.body.tindakan, f, k), f, k);
      return ambil(pk.uuid, f, k);
    });
    kirim(res, hasil, "Paket fisioterapi berhasil diperbarui");
  }),
);

// Hapus lunak: order lama tetap menyimpan paket_uuid & nilai_paket per tindakan.
rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const pk = await ubah("fisio_paket", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!pk) throw tidakDitemukan("Paket fisioterapi");
    kirim(res, { uuid: pk.uuid }, "Paket fisioterapi berhasil dihapus");
  }),
);

// Terapkan paket ke order: { paket, jenis_fisio, jumlah_sesi, tindakan: [{ tindakan_uuid, nama, harga, qty, nilai_paket }] }.
// harga = tarif satuan (snapshot), nilai_paket = bagian harga paket untuk tindakan tsb (seluruh sesi).
export const terapkanPaket = async (paketUuid, faskesUuid, k) => {
  const pk = await satu(
    `SELECT uuid, kode, nama, jenis_fisio, jumlah_sesi, harga FROM fisio_paket WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`,
    [paketUuid, faskesUuid],
    k,
  );
  if (!pk) throw permintaanSalah("Paket fisioterapi tidak ditemukan atau tidak aktif");
  const isi = await tindakanPaket([pk.uuid], k);
  if (!isi.length) throw permintaanSalah(`Paket ${pk.nama} belum berisi tindakan`);
  if (isi.some((t) => !t.aktif)) throw permintaanSalah(`Paket ${pk.nama} berisi tindakan yang tidak aktif; perbarui paket terlebih dahulu`);
  const nilai = alokasiProporsional(pk.harga, isi.map((t) => Number(t.harga) * Number(t.qty)));
  return {
    paket: pk,
    jenis_fisio: pk.jenis_fisio,
    jumlah_sesi: Number(pk.jumlah_sesi),
    tindakan: isi.map((t, i) => ({ tindakan_uuid: t.tindakan_uuid, nama: t.nama, harga: t.harga, qty: Number(t.qty), nilai_paket: nilai[i] })),
  };
};

export default rute;
