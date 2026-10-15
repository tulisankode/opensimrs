import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { ramah, susunStasiun, JENIS_ITEM, JENIS_PAKET, namaStasiun, hargaKontrak, hariIni, tanggalValid } from "./bersama.js";
import { izinMcu } from "../umum/izin.js";
import { rencanaLab } from "./lab.js";

// Datamaster Paket MCU: harga paket, daftar stasiun pemeriksaan, dan isi paket (item lab / radiologi / tindakan).
const rute = express.Router();

const PILIH = `p.uuid, p.kode, p.nama, p.deskripsi, p.harga::float8 AS harga, p.jenis, p.stasiun, p.status, p.created_at, p.updated_at,
  (SELECT COUNT(*)::int FROM mcu_paket_item i WHERE i.paket_uuid = p.uuid AND i.deleted_at IS NULL) AS jumlah_item`;

export const itemPaket = (paketUuid, k) =>
  query(
    `SELECT i.uuid, i.jenis, i.ref_uuid, i.tarif_lab_uuid, i.nama, i.satuan, i.nilai_rujukan, i.urutan,
            r.kode AS ref_kode, r.modalitas, r.harga::float8 AS harga_ref, tl.code AS kode_tarif_lab
       FROM mcu_paket_item i
       LEFT JOIN rad_pemeriksaan r ON i.jenis = 'radiologi' AND r.uuid = i.ref_uuid
       LEFT JOIN tarif_lab tl ON i.jenis = 'lab' AND tl.uuid = i.tarif_lab_uuid
      WHERE i.paket_uuid = $1 AND i.deleted_at IS NULL
      ORDER BY CASE i.jenis WHEN 'lab' THEN 1 WHEN 'radiologi' THEN 2 ELSE 3 END, i.urutan, i.created_at`,
    [paketUuid],
    k,
  );

export const ambilPaket = async (uuid, faskesUuid, k) => {
  const p = await satu(`SELECT ${PILIH} FROM mcu_paket p WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!p) return null;
  const items = await itemPaket(uuid, k);
  // Rencana order lab otomatis (pemeriksaan lab yang akan diorder ke Laboratorium saat peserta didaftarkan).
  const r = await rencanaLab(items, faskesUuid, k);
  const rencana_lab = { tarif: r.tarif.map(({ items: _i, ...t }) => t), manual: r.manual.map((i) => i.nama), konflik: r.konflik };
  return { ...p, items, rencana_lab, stasiun_detail: (p.stasiun ?? []).map((s) => ({ kode: s, nama: namaStasiun(s) })) };
};

const tanpaKosong = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const KOLOM = (b) => {
  if (b.jenis !== undefined && !JENIS_PAKET.includes(b.jenis)) throw permintaanSalah(`jenis harus salah satu: ${JENIS_PAKET.join(", ")}`);
  if (b.harga !== undefined && (!Number.isFinite(Number(b.harga)) || Number(b.harga) < 0)) throw permintaanSalah("harga tidak valid");
  return {
    kode: b.kode === undefined ? undefined : String(b.kode).trim().toUpperCase(),
    nama: b.nama === undefined ? undefined : String(b.nama).trim(),
    deskripsi: b.deskripsi === undefined ? undefined : String(b.deskripsi ?? "").trim() || null,
    harga: b.harga === undefined ? undefined : Number(b.harga),
    jenis: b.jenis,
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
};

// Validasi & lengkapi item paket. Radiologi wajib menunjuk master rad_pemeriksaan faskes; lab boleh menunjuk
// master item_pemeriksaan (satuan diambil dari master) atau teks bebas.
const siapkanItem = async (items, faskesUuid, k) => {
  if (!Array.isArray(items)) throw permintaanSalah("items harus berupa array");
  const hasil = [];
  for (const [n, it] of items.entries()) {
    if (!JENIS_ITEM.includes(it?.jenis)) throw permintaanSalah(`items[${n}].jenis harus salah satu: ${JENIS_ITEM.join(", ")}`);
    let nama = String(it.nama ?? "").trim();
    let satuan = it.satuan ? String(it.satuan).trim() : null;
    let ref = it.ref_uuid || null;
    let tarif = it.jenis === "lab" ? it.tarif_lab_uuid || null : null;
    if (it.jenis === "radiologi") {
      if (!ref) throw permintaanSalah(`items[${n}]: pemeriksaan radiologi wajib dipilih dari master radiologi`);
      const r = await satu(`SELECT nama FROM rad_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [ref, faskesUuid], k);
      if (!r) throw permintaanSalah(`items[${n}]: pemeriksaan radiologi tidak ditemukan di master`);
      nama ||= r.nama;
    } else if (it.jenis === "lab" && tarif) {
      const r = await satu(`SELECT name FROM tarif_lab WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [tarif, faskesUuid], k);
      if (!r) throw permintaanSalah(`items[${n}]: pemeriksaan lab (tarif) tidak ditemukan di master Laboratorium`);
      nama ||= r.name;
      ref = null;
    } else if (it.jenis === "lab" && ref) {
      const r = await satu(`SELECT name, satuan FROM item_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [ref, faskesUuid], k);
      if (r) {
        nama ||= r.name;
        satuan ||= r.satuan || null;
      }
    }
    if (!nama) throw permintaanSalah(`items[${n}].nama wajib diisi`);
    hasil.push({ jenis: it.jenis, ref_uuid: ref, tarif_lab_uuid: tarif, nama, satuan, nilai_rujukan: it.nilai_rujukan ? String(it.nilai_rujukan).trim() : null, urutan: n });
  }
  return hasil;
};

// Pemeriksaan lab paket tidak boleh memuat parameter ganda (lab-service menolak order dengan parameter duplikat).
const cekKonflikLab = async (items, faskesUuid, k) => {
  const r = await rencanaLab(items, faskesUuid, k);
  if (r.konflik.length) throw permintaanSalah(`Isi lab paket bertumpang tindih: ${r.konflik.join("; ")}`);
};

const simpanItem = async (paketUuid, items, faskesUuid, k) => {
  await query(`DELETE FROM mcu_paket_item WHERE paket_uuid = $1`, [paketUuid], k);
  for (const it of items) await sisipkan("mcu_paket_item", { faskes_uuid: faskesUuid, paket_uuid: paketUuid, ...it }, k);
};

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (p.kode ILIKE $${p.length} OR p.nama ILIKE $${p.length})`;
    }
    if (req.query.jenis) {
      // Paket "semua" berlaku untuk perorangan maupun korporasi.
      p.push(req.query.jenis);
      w += ` AND (p.jenis = 'semua' OR p.jenis = $${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND p.status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM mcu_paket p WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM mcu_paket p WHERE ${w} ORDER BY p.harga, p.nama LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    if (["1", "true"].includes(String(req.query.dengan_item))) {
      for (const r of rows) r.items = await itemPaket(r.uuid);
    }
    // Harga kontrak perusahaan (bila ?perusahaan_uuid=): harga_berlaku = kontrak pada tanggal MCU, selain itu harga paket.
    if (req.query.perusahaan_uuid) {
      const tgl = tanggalValid(req.query.tanggal || hariIni());
      for (const r of rows) {
        const kt = await hargaKontrak(req.query.perusahaan_uuid, r.uuid, tgl);
        r.harga_kontrak = kt?.harga ?? null;
        r.harga_berlaku = kt ? kt.harga : r.harga;
      }
    }
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const p = await ambilPaket(req.params.uuid, req.author.faskesUuid);
    if (!p) throw tidakDitemukan("Paket MCU");
    kirim(res, p);
  }),
);

rute.post(
  "/",
  izinMcu("Datamaster", "CREATE", "Paket MCU"),
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const items = await siapkanItem(req.body.items ?? [], f, k);
      const stasiun = susunStasiun(req.body.stasiun ?? [], items);
      const p = await sisipkan("mcu_paket", { faskes_uuid: f, harga: 0, jenis: "semua", ...tanpaKosong(KOLOM(req.body)), stasiun, status: req.body.status ?? true }, k).catch((e) =>
        ramah(e, `Kode paket ${req.body.kode} sudah dipakai`),
      );
      await simpanItem(p.uuid, items, f, k);
      await cekKonflikLab(items, f, k);
      return ambilPaket(p.uuid, f, k);
    });
    kirim(res, hasil, "Paket MCU berhasil ditambahkan");
  }),
);

// items & stasiun bersifat opsional: bila dikirim, isi paket diganti seluruhnya. Peserta lama tidak terpengaruh
// (stasiun peserta disalin saat pendaftaran).
rute.put(
  "/:uuid",
  izinMcu("Datamaster", "UPDATE", "Paket MCU"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const lama = await ambilPaket(req.params.uuid, f, k);
      if (!lama) throw tidakDitemukan("Paket MCU");
      const items = req.body.items !== undefined ? await siapkanItem(req.body.items, f, k) : null;
      const stasiun =
        req.body.stasiun !== undefined || items ? susunStasiun(req.body.stasiun ?? lama.stasiun, items ?? lama.items) : undefined;
      await ubah("mcu_paket", lama.uuid, f, { ...KOLOM(req.body), stasiun }, k).catch((e) => ramah(e, `Kode paket ${req.body.kode} sudah dipakai`));
      if (items) {
        await simpanItem(lama.uuid, items, f, k);
        await cekKonflikLab(items, f, k);
      }
      return ambilPaket(lama.uuid, f, k);
    });
    kirim(res, hasil, "Paket MCU berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izinMcu("Datamaster", "DELETE", "Paket MCU"),
  tangani(async (req, res) => {
    const r = await ubah("mcu_paket", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Paket MCU");
    kirim(res, { uuid: r.uuid }, "Paket MCU berhasil dihapus");
  }),
);

export default rute;
