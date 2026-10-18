import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, Galat } from "../umum/respons.js";
import { izinHd, wajibSalahSatu } from "../umum/izin.js";
import { STATUS_MESIN, angka, jamValid, pilihan, ramah, teks } from "./bersama.js";

// Datamaster Unit Hemodialisa: mesin HD, shift, dan aturan batas pemakaian dializer per item BHP (kebijakan reuse
// faskes — sistem tidak menetapkan batas sendiri, PRD §12). Hapus = soft delete; mesin/shift yang masih punya jadwal
// mendatang tidak dapat dihapus.
const rute = express.Router();
const izinMaster = (aksi) => izinHd("Datamaster", aksi, "Mesin & Shift");
const izinAturan = (aksi) => izinHd("Datamaster", aksi, "Aturan Reuse Dializer");

// ── Mesin ────────────────────────────────────────────────────────────────────
rute.get(
  "/mesin",
  izinMaster("READ"),
  tangani(async (req, res) =>
    kirim(res, await query(`SELECT * FROM hd_mesin WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY kode`, [req.author.faskesUuid])),
  ),
);

const dataMesin = (b, baru) => {
  if (baru) wajib(b, ["kode", "nama"]);
  return {
    kode: b.kode === undefined ? undefined : teks(b.kode, 40),
    nama: b.nama === undefined ? undefined : teks(b.nama, 120),
    status: b.status === undefined ? (baru ? "aktif" : undefined) : pilihan(b.status, STATUS_MESIN, "status"),
    keterangan: b.keterangan === undefined ? undefined : teks(b.keterangan),
  };
};

rute.post(
  "/mesin",
  izinMaster("CREATE"),
  tangani(async (req, res) => {
    const data = dataMesin(req.body ?? {}, true);
    const baris = await sisipkan("hd_mesin", { faskes_uuid: req.author.faskesUuid, ...data }).catch((e) => ramah(e, `Kode mesin ${data.kode} sudah dipakai`));
    kirim(res, baris, "Mesin HD ditambahkan");
  }),
);

rute.put(
  "/mesin/:uuid",
  izinMaster("UPDATE"),
  tangani(async (req, res) => {
    const data = dataMesin(req.body ?? {}, false);
    if (data.kode === null || data.nama === null) throw new Galat(400, "kode dan nama tidak boleh kosong");
    const baris = await ubah("hd_mesin", req.params.uuid, req.author.faskesUuid, data).catch((e) => ramah(e, `Kode mesin ${data.kode} sudah dipakai`));
    if (!baris) throw tidakDitemukan("Mesin HD");
    kirim(res, baris, "Mesin HD diperbarui");
  }),
);

const masihDijadwalkan = (kolom, uuid, faskes) =>
  satu(
    `SELECT COUNT(*)::int n FROM hd_jadwal WHERE ${kolom} = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
        AND status IN ('terjadwal','hadir','berjalan')`,
    [uuid, faskes],
  );

rute.delete(
  "/mesin/:uuid",
  izinMaster("DELETE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    if ((await masihDijadwalkan("mesin_uuid", req.params.uuid, f)).n) throw new Galat(409, "Mesin masih memiliki jadwal aktif; pindahkan atau batalkan jadwalnya terlebih dahulu");
    const baris = await satu(`UPDATE hd_mesin SET deleted_at = $3, status = 'nonaktif', updated_at = $3 WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL RETURNING uuid`, [
      req.params.uuid, f, sekarang(),
    ]);
    if (!baris) throw tidakDitemukan("Mesin HD");
    kirim(res, baris, "Mesin HD dihapus");
  }),
);

// ── Shift ────────────────────────────────────────────────────────────────────
rute.get(
  "/shift",
  izinMaster("READ"),
  tangani(async (req, res) =>
    kirim(res, await query(`SELECT * FROM hd_shift WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY urutan, jam_mulai`, [req.author.faskesUuid])),
  ),
);

const dataShift = (b, baru) => {
  if (baru) wajib(b, ["kode", "nama", "jam_mulai", "jam_selesai"]);
  return {
    kode: b.kode === undefined ? undefined : teks(b.kode, 40),
    nama: b.nama === undefined ? undefined : teks(b.nama, 100),
    jam_mulai: b.jam_mulai === undefined ? undefined : jamValid(b.jam_mulai, "jam_mulai"),
    jam_selesai: b.jam_selesai === undefined ? undefined : jamValid(b.jam_selesai, "jam_selesai"),
    urutan: b.urutan === undefined ? (baru ? 0 : undefined) : angka(b.urutan, "urutan", { min: 0, maks: 99, bulat: true }),
    aktif: b.aktif === undefined ? undefined : b.aktif !== false,
  };
};

rute.post(
  "/shift",
  izinMaster("CREATE"),
  tangani(async (req, res) => {
    const data = dataShift(req.body ?? {}, true);
    const baris = await sisipkan("hd_shift", { faskes_uuid: req.author.faskesUuid, ...data, aktif: data.aktif ?? true }).catch((e) => ramah(e, `Kode shift ${data.kode} sudah dipakai`));
    kirim(res, baris, "Shift HD ditambahkan");
  }),
);

rute.put(
  "/shift/:uuid",
  izinMaster("UPDATE"),
  tangani(async (req, res) => {
    const data = dataShift(req.body ?? {}, false);
    if (data.kode === null || data.nama === null) throw new Galat(400, "kode dan nama tidak boleh kosong");
    const baris = await ubah("hd_shift", req.params.uuid, req.author.faskesUuid, data).catch((e) => ramah(e, `Kode shift ${data.kode} sudah dipakai`));
    if (!baris) throw tidakDitemukan("Shift HD");
    kirim(res, baris, "Shift HD diperbarui");
  }),
);

rute.delete(
  "/shift/:uuid",
  izinMaster("DELETE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    if ((await masihDijadwalkan("shift_uuid", req.params.uuid, f)).n) throw new Galat(409, "Shift masih memiliki jadwal aktif; pindahkan atau batalkan jadwalnya terlebih dahulu");
    const baris = await satu(`UPDATE hd_shift SET deleted_at = $3, aktif = false, updated_at = $3 WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL RETURNING uuid`, [
      req.params.uuid, f, sekarang(),
    ]);
    if (!baris) throw tidakDitemukan("Shift HD");
    kirim(res, baris, "Shift HD dihapus");
  }),
);

// ── Aturan batas pemakaian dializer ──────────────────────────────────────────
rute.get(
  "/dializer-aturan",
  izinAturan("READ"),
  tangani(async (req, res) =>
    kirim(
      res,
      await query(
        `SELECT a.*, im.code AS kode_item, im.name AS nama_item FROM hd_dializer_aturan a JOIN item_medis im ON im.uuid = a.item_medis_uuid
          WHERE a.faskes_uuid = $1 AND a.deleted_at IS NULL ORDER BY im.name`,
        [req.author.faskesUuid],
      ),
    ),
  ),
);

// Item BHP faskes (untuk memilih item dializer/BHP di form). ?cari= kode atau nama, maks. 30.
rute.get(
  "/item-medis",
  wajibSalahSatu(["Hemodialisa", "Pemakaian BHP", "READ"], ["Hemodialisa", "Datamaster", "READ", "Aturan Reuse Dializer"]),
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    kirim(
      res,
      await query(
        `SELECT uuid, code AS kode, name AS nama, jenis_item FROM item_medis
          WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status AND ($2 = '' OR name ILIKE $3 OR code ILIKE $3)
          ORDER BY name LIMIT 30`,
        [req.author.faskesUuid, cari, `%${cari}%`],
      ),
    );
  }),
);

rute.post(
  "/dializer-aturan",
  izinAturan("CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["item_medis_uuid", "pemakaian_maksimal"]);
    const f = req.author.faskesUuid;
    const item = await satu(`SELECT uuid, name FROM item_medis WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.item_medis_uuid, f]);
    if (!item) throw tidakDitemukan("Item medis");
    const baris = await sisipkan("hd_dializer_aturan", {
      faskes_uuid: f,
      item_medis_uuid: item.uuid,
      pemakaian_maksimal: angka(b.pemakaian_maksimal, "pemakaian_maksimal", { min: 1, maks: 100, bulat: true }),
      dasar_kebijakan: teks(b.dasar_kebijakan),
      diubah_oleh: req.author.username ?? null,
    }).catch((e) => ramah(e, `Aturan untuk ${item.name} sudah ada; ubah aturan yang ada`));
    kirim(res, baris, "Aturan batas pemakaian dializer disimpan");
  }),
);

// Perubahan batas hanya berlaku untuk dializer yang didaftarkan sesudahnya (dializer lama memakai batas saat didaftarkan).
rute.put(
  "/dializer-aturan/:uuid",
  izinAturan("UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const baris = await ubah("hd_dializer_aturan", req.params.uuid, req.author.faskesUuid, {
      pemakaian_maksimal: b.pemakaian_maksimal === undefined ? undefined : angka(b.pemakaian_maksimal, "pemakaian_maksimal", { min: 1, maks: 100, bulat: true }),
      dasar_kebijakan: b.dasar_kebijakan === undefined ? undefined : teks(b.dasar_kebijakan),
      diubah_oleh: req.author.username ?? null,
    });
    if (!baris) throw tidakDitemukan("Aturan dializer");
    kirim(res, baris, "Aturan batas pemakaian dializer diperbarui");
  }),
);

rute.delete(
  "/dializer-aturan/:uuid",
  izinAturan("DELETE"),
  tangani(async (req, res) => {
    const baris = await satu(`UPDATE hd_dializer_aturan SET deleted_at = $3, updated_at = $3 WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL RETURNING uuid`, [
      req.params.uuid, req.author.faskesUuid, sekarang(),
    ]);
    if (!baris) throw tidakDitemukan("Aturan dializer");
    kirim(res, baris, "Aturan batas pemakaian dializer dihapus");
  }),
);

export default rute;
