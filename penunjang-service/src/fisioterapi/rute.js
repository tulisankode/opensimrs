import express from "express";
import { query } from "../db.js";
import { kirim, tangani } from "../umum/respons.js";
import { JAM_SLOT, JENIS_FISIO, FASE_REHAB } from "./bersama.js";
import bed from "./bed.js";
import tindakan from "./tindakan.js";
import paket from "./paket.js";
import order from "./order.js";
import jadwal from "./jadwal.js";
import evaluasi from "./evaluasi.js";
import laporan from "./laporan.js";

// Fisioterapi / Rehabilitasi Medik — /api/v3/penunjang/fisioterapi/...
//   /referensi                 jam terapi, jenis fisioterapi, fase rehabilitasi
//   /pasien?cari=              pencarian pasien terdaftar
//   /bed, /tindakan, /paket    datamaster (paket = tindakan + jumlah sesi + harga paket)
//   /order                     order terapi (RME / APS / booking), validasi, batal
//   /slot, /ketersediaan       ketersediaan bed per jam terapi
//   /jadwal, /booking          penjadwalan sesi & booking terapi
//   /evaluasi                  evaluasi rehab medik per sesi & riwayat pasien
//   /laporan/...               kunjungan, rekap jenis, rekap tindakan, rekap pendapatan
const rute = express.Router();

rute.get("/referensi", (req, res) => kirim(res, { jam_slot: JAM_SLOT, jenis_fisio: JENIS_FISIO, fase_rehabilitasi: FASE_REHAB }));

// GET /pasien?cari= — cari pasien terdaftar (nama / No. RM / No. HP) untuk order APS & booking.
rute.get(
  "/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const rows = await query(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.phone, to_char(bd.birth_date, 'YYYY-MM-DD') AS birth_date
         FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL
          AND ($2 = '' OR p.name ILIKE $3 OR p.no_rm ILIKE $3 OR p.phone ILIKE $3)
        ORDER BY p.name LIMIT 20`,
      [req.author.faskesUuid, cari, `%${cari}%`],
    );
    kirim(res, rows);
  }),
);
rute.use("/bed", bed);
rute.use("/tindakan", tindakan);
rute.use("/paket", paket);
rute.use("/order", order);
rute.use("/evaluasi", evaluasi);
rute.use("/laporan", laporan);
rute.use("/", jadwal);

export default rute;
