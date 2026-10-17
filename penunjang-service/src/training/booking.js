import express from "express";
import { query, satu, ubah, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, permintaanSalah } from "../umum/respons.js";
import { izinTraining } from "../umum/izin.js";
import { tanggalValid } from "./bersama.js";
import { PILIH_ORDER, DARI_ORDER, detailOrder, buatBaris, perbaruiBooking, konversiKeOrder, batalkan, ketersediaan } from "./order.js";

// Ketersediaan slot & booking kelas Training (lihat order.js untuk baris bersama booking/order).
const rute = express.Router();

// GET /slot?kelas_uuid=&tanggal_kelas= → ketersediaan per sesi (atau tingkat kelas bila tanpa sesi).
rute.get(
  "/slot",
  izinTraining("Booking Kelas", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.query, ["kelas_uuid", "tanggal_kelas"]);
    const tanggal = tanggalValid(req.query.tanggal_kelas, "tanggal_kelas");
    const kelas = await satu(`SELECT * FROM training_kelas WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.query.kelas_uuid, f]);
    if (!kelas) throw permintaanSalah("Kelas Training tidak ditemukan");
    if (!kelas.is_sesi) {
      const kuota = await ketersediaan(f, kelas, tanggal, null);
      return kirim(res, { kelas_uuid: kelas.uuid, tanggal_kelas: tanggal, is_sesi: false, ...kuota });
    }
    const sesiKelas = await query(`SELECT uuid, nama_sesi, jam_mulai, jam_selesai FROM training_kelas_sesi WHERE kelas_uuid = $1 AND deleted_at IS NULL ORDER BY urutan, created_at`, [kelas.uuid]);
    const sesi = await Promise.all(sesiKelas.map(async (s) => ({ sesi_uuid: s.uuid, nama_sesi: s.nama_sesi, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai, ...(await ketersediaan(f, kelas, tanggal, s.uuid)) })));
    kirim(res, { kelas_uuid: kelas.uuid, tanggal_kelas: tanggal, is_sesi: true, sesi });
  }),
);

// GET /booking — daftar booking (training_order berstatus booking).
rute.get(
  "/booking",
  izinTraining("Booking Kelas", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "o.faskes_uuid = $1 AND o.status = 'booking'";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.kelas_uuid) tambah(q.kelas_uuid, "o.kelas_uuid = $?");
    if (q.tanggal_mulai) tambah(tanggalValid(q.tanggal_mulai, "tanggal_mulai"), "o.tanggal_kelas >= $?::date");
    if (q.tanggal_selesai) tambah(tanggalValid(q.tanggal_selesai, "tanggal_selesai"), "o.tanggal_kelas <= $?::date");
    if (q.cari) tambah(`%${q.cari}%`, "(p.name ILIKE $? OR o.no_rm ILIKE $? OR o.no_order ILIKE $?)");
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_ORDER} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE ${w} ORDER BY o.tanggal_kelas, o.created_at LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/booking/:uuid",
  izinTraining("Booking Kelas", "READ"),
  tangani(async (req, res) => kirim(res, await detailOrder(req.params.uuid, req.author.faskesUuid))),
);

// POST /booking { kelas_uuid, tanggal_kelas, sesi_uuid?, patient_uuid } — belum ada tagihan.
rute.post(
  "/booking",
  izinTraining("Booking Kelas", "CREATE BOOKING"),
  tangani(async (req, res) => {
    const hasil = await transaksi((k) => buatBaris(req.body, req.author, k, "booking"));
    kirim(res, hasil, `Booking ${hasil.no_order} berhasil dibuat`);
  }),
);

// PUT /booking/:uuid { tanggal_kelas?, sesi_uuid?, patient_uuid? } — hanya selama masih berstatus booking.
rute.put(
  "/booking/:uuid",
  izinTraining("Booking Kelas", "UPDATE BOOKING"),
  tangani(async (req, res) => {
    const hasil = await transaksi((k) => perbaruiBooking(req.params.uuid, req.author.faskesUuid, req.body ?? {}, k));
    kirim(res, hasil, `Booking ${hasil.no_order} berhasil diubah`);
  }),
);

// POST /booking/:uuid/daftar { payment_method, penjamin_uuid? } — lanjut ke pendaftaran (booking → order + tagihan).
rute.post(
  "/booking/:uuid/daftar",
  izinTraining("Booking Kelas", "DAFTAR"),
  tangani(async (req, res) => {
    const hasil = await transaksi((k) => konversiKeOrder(req.params.uuid, req.author.faskesUuid, req.body ?? {}, req.author, k));
    kirim(res, hasil, `Booking dilanjutkan menjadi order ${hasil.no_order}`);
  }),
);

// PUT /booking/:uuid/batal { alasan } — batal booking; slot kembali tersedia.
rute.put(
  "/booking/:uuid/batal",
  izinTraining("Booking Kelas", "BATAL BOOKING"),
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const hasil = await transaksi((k) => batalkan(req.params.uuid, req.author.faskesUuid, req.body.alasan, req.author, k));
    kirim(res, hasil, `Booking ${hasil.no_order} dibatalkan`);
  }),
);

export default rute;
