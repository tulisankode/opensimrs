import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import kelas from "./kelas.js";
import booking from "./booking.js";
import order from "./order.js";
import laporan from "./laporan.js";

// Training — /api/v3/penunjang/training/...
//   /kelas                     datamaster kelas Training & sesi (CRUD, ?cari=&status=; /kelas/impor)
//   /slot                      ketersediaan slot per kelas + tanggal (+ sesi)
//   /booking                   booking kelas: daftar, detail, buat, ubah, lanjut daftar, batal
//   /order                     order (pendaftaran) kelas: daftar, detail, buat, batal
//   /laporan/rekapitulasi      rekap kunjungan kelas (order bukan batal) per periode & kelas
//   /pasien?cari=              pencarian pasien terdaftar (master Admisi) untuk booking/pendaftaran
const rute = express.Router();

rute.use("/kelas", kelas);
rute.use("/", booking);
rute.use("/order", order);
rute.use("/laporan", laporan);

// Pencarian pasien terdaftar (nama / No. RM / No. HP) untuk booking & pendaftaran kelas. Training tidak membuat
// atau mengubah master pasien; pasien selalu dipilih dari master Admisi yang sudah ada.
rute.get(
  "/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const rows = await query(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.phone, to_char(bd.birth_date, 'YYYY-MM-DD') AS birth_date
         FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status IS NOT FALSE
          AND ($2 = '' OR p.name ILIKE $3 OR p.no_rm ILIKE $3 OR p.phone ILIKE $3)
        ORDER BY p.name LIMIT 20`,
      [req.author.faskesUuid, cari, `%${cari}%`],
    );
    kirim(res, rows);
  }),
);

export default rute;
