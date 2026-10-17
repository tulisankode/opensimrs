import express from "express";
import { query, satu, sisipkan, ubah, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { cariKunjungan, kunjunganDariRekamMedis, pasien } from "../umum/kunjungan.js";
import { izinOk } from "../umum/izin.js";
import { sumberValid, jenisOperasiValid, kelasOperasiValid } from "./bersama.js";

// Order Operasi: dibuat dari Plan asesmen RJ/RI/IGD (rekam_medis_uuid). Daftar tunggu: order cito tampil sebelum
// order elektif (ok_order_antrean_idx), tanpa mengubah waktu pembuatan order elektif (KT-2).
// Alur status: menunggu_jadwal ⇄ perlu_klarifikasi (A2) → terjadwal (saat ok_jadwal dibuat, lihat jadwal.js) →
// kembali ke menunggu_jadwal bila jadwal dibatalkan (A5).
const rute = express.Router();

const PILIH_ORDER = `
  o.uuid, o.faskes_uuid, o.no_order, o.patient_uuid, o.no_rm, o.no_reg, o.rekam_medis_uuid, o.sumber,
  o.lokasi_asal_uuid, o.dokter_pengirim_uuid, o.payment_method, o.penjamin_uuid,
  o.diagnosis_kode, o.diagnosis_nama, o.jenis_operasi, o.durasi_estimasi_menit, o.status,
  o.catatan_klarifikasi, o.alasan_batal, o.dibuat_oleh, o.created_at::float8 AS created_at, o.updated_at::float8 AS updated_at,
  p.name AS nama_pasien, p.gender, p.phone AS no_hp, to_char(bd.birth_date, 'YYYY-MM-DD') AS tanggal_lahir`;
const DARI_ORDER = `ok_order o LEFT JOIN patients p ON p.uuid = o.patient_uuid LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid`;

export const tindakanOrder = (orderUuid, k) =>
  query(
    `SELECT uuid, kode_icd9cm, nama_tindakan, kelas_operasi, urutan FROM ok_order_tindakan
      WHERE order_uuid = $1 AND deleted_at IS NULL ORDER BY urutan, created_at`,
    [orderUuid],
    k,
  );

export const ambilOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT * FROM ok_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${k ? "FOR UPDATE" : ""}`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order operasi");
  return o;
};

export const detailOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE o.uuid = $1 AND o.faskes_uuid = $2 AND o.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order operasi");
  const [tindakan, jadwal] = await Promise.all([
    tindakanOrder(uuid, k),
    satu(
      `SELECT uuid, ruang_uuid, waktu_mulai::float8 AS waktu_mulai, waktu_selesai::float8 AS waktu_selesai, status
         FROM ok_jadwal WHERE order_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [uuid],
      k,
    ),
  ]);
  return { ...o, tindakan, jadwal };
};

const siapkanTindakan = (daftar) => {
  if (!Array.isArray(daftar) || daftar.length === 0) throw permintaanSalah("Minimal satu rencana tindakan (ICD-9-CM) wajib diisi");
  return daftar.map((t, i) => {
    const kode = String(t?.kode_icd9cm ?? "").trim();
    const nama = String(t?.nama ?? t?.nama_tindakan ?? "").trim();
    if (!kode || !nama) throw permintaanSalah("Setiap tindakan wajib memiliki kode_icd9cm dan nama");
    return { kode_icd9cm: kode, nama_tindakan: nama, kelas_operasi: kelasOperasiValid(t.kelas_operasi), urutan: i + 1 };
  });
};

// ── Rute ───────────────────────────────────────────────────────────────────────────

// ?status=&jenis_operasi=&sumber=&patient_uuid=&rekam_medis_uuid=&cari=
rute.get(
  "/",
  izinOk("Order Operasi", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "o.faskes_uuid = $1 AND o.deleted_at IS NULL";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.status) tambah(String(q.status).split(","), "o.status = ANY($?)");
    if (q.jenis_operasi) tambah(String(q.jenis_operasi).split(","), "o.jenis_operasi = ANY($?)");
    if (q.sumber) tambah(String(q.sumber).split(","), "o.sumber = ANY($?)");
    if (q.patient_uuid) tambah(q.patient_uuid, "o.patient_uuid = $?");
    if (q.rekam_medis_uuid) tambah(q.rekam_medis_uuid, "o.rekam_medis_uuid = $?");
    if (q.cari) tambah(`%${q.cari}%`, "(p.name ILIKE $? OR o.no_rm ILIKE $? OR o.no_order ILIKE $?)");
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_ORDER} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE ${w}
        ORDER BY (o.status = 'menunggu_jadwal' AND o.jenis_operasi = 'cito') DESC, o.created_at
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  izinOk("Order Operasi", "READ"),
  tangani(async (req, res) => kirim(res, await detailOrder(req.params.uuid, req.author.faskesUuid))),
);

// POST / { rekam_medis_uuid (atau no_reg), sumber, diagnosis_kode, diagnosis_nama, jenis_operasi, durasi_estimasi_menit, tindakan[] }
rute.post(
  "/",
  izinOk("Order Operasi", "CREATE"),
  tangani(async (req, res) => {
    wajib(req.body, ["sumber", "jenis_operasi", "durasi_estimasi_menit"]);
    const f = req.author.faskesUuid;
    const b = req.body;
    const sumber = sumberValid(b.sumber);
    const jenisOperasi = jenisOperasiValid(b.jenis_operasi);
    const durasi = Number(b.durasi_estimasi_menit);
    if (!Number.isInteger(durasi) || durasi <= 0) throw permintaanSalah("durasi_estimasi_menit harus bilangan bulat positif");
    const tindakan = siapkanTindakan(b.tindakan);

    let kunjungan = null;
    if (b.rekam_medis_uuid) kunjungan = await kunjunganDariRekamMedis(b.rekam_medis_uuid, f);
    if (!kunjungan && b.no_reg) kunjungan = await cariKunjungan(b.no_reg, f);
    if (!kunjungan) throw permintaanSalah("Kunjungan asal (rekam medis / No. Reg) tidak ditemukan");

    const p = await pasien(kunjungan.patient_uuid, f);
    if (!p) throw tidakDitemukan("Pasien");

    const hasil = await transaksi(async (k) => {
      const order = await sisipkan(
        "ok_order",
        {
          faskes_uuid: f,
          no_order: await nomorBaru(f, "OK", k),
          patient_uuid: p.uuid,
          no_rm: p.no_rm,
          no_reg: kunjungan.no_reg,
          rekam_medis_uuid: b.rekam_medis_uuid ?? kunjungan.rekam_medis_uuid ?? null,
          sumber,
          lokasi_asal_uuid: kunjungan.lokasi_uuid ?? null,
          dokter_pengirim_uuid: b.dokter_pengirim_uuid ?? kunjungan.practitioner_uuid ?? null,
          payment_method: Number(kunjungan.payment_method ?? 1),
          penjamin_uuid: b.penjamin_uuid ?? null,
          diagnosis_kode: b.diagnosis_kode ?? null,
          diagnosis_nama: b.diagnosis_nama ?? null,
          jenis_operasi: jenisOperasi,
          durasi_estimasi_menit: durasi,
          status: "menunggu_jadwal",
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      for (const t of tindakan) await sisipkan("ok_order_tindakan", { faskes_uuid: f, order_uuid: order.uuid, ...t }, k);
      return detailOrder(order.uuid, f, k);
    });
    kirim(res, hasil, `Order operasi ${hasil.no_order} berhasil dibuat`);
  }),
);

// PATCH /:uuid/klarifikasi { catatan } — kembalikan order ke dokter pemesan (A2); tidak dapat dijadwalkan.
rute.patch(
  "/:uuid/klarifikasi",
  izinOk("Order Operasi", "KLARIFIKASI"),
  tangani(async (req, res) => {
    wajib(req.body, ["catatan"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const o = await ambilOrder(req.params.uuid, f, k);
      if (!["menunggu_jadwal", "perlu_klarifikasi"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status} tidak dapat diminta klarifikasi`);
      await ubah("ok_order", o.uuid, f, { status: "perlu_klarifikasi", catatan_klarifikasi: req.body.catatan }, k);
      return detailOrder(o.uuid, f, k);
    });
    kirim(res, hasil, "Order dikembalikan untuk klarifikasi");
  }),
);

// PATCH /:uuid/lengkapi — dokter pemesan melengkapi ulang order berstatus perlu_klarifikasi.
rute.patch(
  "/:uuid/lengkapi",
  izinOk("Order Operasi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body;
    const hasil = await transaksi(async (k) => {
      const o = await ambilOrder(req.params.uuid, f, k);
      if (o.status !== "perlu_klarifikasi") throw new Galat(409, `Order berstatus ${o.status}; hanya order perlu klarifikasi yang dapat dilengkapi`);
      await ubah(
        "ok_order",
        o.uuid,
        f,
        {
          diagnosis_kode: b.diagnosis_kode,
          diagnosis_nama: b.diagnosis_nama,
          jenis_operasi: b.jenis_operasi === undefined ? undefined : jenisOperasiValid(b.jenis_operasi),
          durasi_estimasi_menit: b.durasi_estimasi_menit === undefined ? undefined : Number(b.durasi_estimasi_menit),
          status: "menunggu_jadwal",
          catatan_klarifikasi: null,
        },
        k,
      );
      if (b.tindakan !== undefined) {
        const tindakan = siapkanTindakan(b.tindakan);
        await query(`DELETE FROM ok_order_tindakan WHERE order_uuid = $1`, [o.uuid], k);
        for (const t of tindakan) await sisipkan("ok_order_tindakan", { faskes_uuid: f, order_uuid: o.uuid, ...t }, k);
      }
      return detailOrder(o.uuid, f, k);
    });
    kirim(res, hasil, "Order berhasil dilengkapi dan kembali menunggu jadwal");
  }),
);

export default rute;
