import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import pemeriksaan from "./pemeriksaan.js";
import paket from "./paket.js";
import order from "./order.js";
import hasil from "./hasil.js";
import laporan from "./laporan.js";
import ruang from "./ruang.js";
import jadwal from "./jadwal.js";
import template from "./template.js";
import petugas from "./petugas.js";

// Radiologi — /api/v3/penunjang/radiologi/...
//   /pemeriksaan              datamaster pemeriksaan (CRUD, ?modalitas=&cari=)
//   /paket                    datamaster paket pemeriksaan (CRUD, isi pemeriksaan + harga paket)
//   /order                    order RME/APS/MCU: daftar, detail, buat, ubah, validasi, batal; /order/kunjungan (RME)
//   /ruang                    datamaster ruang pemeriksaan & alat (modalitas, jam/hari operasional, durasi slot)
//   /jadwal                   penjadwalan per ruang: papan slot, menunggu jadwal, buat/ubah/hadir/batal
//   /template                 datamaster template expertise (bacaan normal) per pemeriksaan/modalitas
//   /petugas                  datamaster dokter radiologi & radiografer (+ /petugas/pilihan untuk dialog)
//   /worklist, /item/:uuid    pemeriksaan radiografer & expertise dokter Sp.Rad
//   /laporan/kunjungan        rekap kunjungan per modalitas & pemeriksaan
//   /referensi/pasien|dokter|praktisi  pencarian pasien (order APS), daftar dokter, daftar praktisi (petugas)
const rute = express.Router();

rute.use("/pemeriksaan", pemeriksaan);
rute.use("/paket", paket);
rute.use("/order", order);
rute.use("/laporan", laporan);
rute.use("/ruang", ruang);
rute.use("/jadwal", jadwal);
rute.use("/template", template);
rute.use("/petugas", petugas);

// Pencarian pasien terdaftar untuk order APS (nama / No. RM / NIK).
rute.get(
  "/referensi/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL";
    if (cari) {
      p.push(`%${cari}%`);
      w += ` AND (p.name ILIKE $2 OR p.no_rm ILIKE $2 OR p.no_identity ILIKE $2)`;
    }
    kirim(
      res,
      await query(
        `SELECT p.uuid, p.no_rm, p.name, p.gender, p.phone, p.no_identity, bd.birth_date
           FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
          WHERE ${w} ORDER BY p.created_at DESC LIMIT 20`,
        p,
      ),
    );
  }),
);

// Dokter aktif faskes (dokter pengirim & dokter radiologi pembaca expertise).
rute.get(
  "/referensi/dokter",
  tangani(async (req, res) =>
    kirim(
      res,
      await query(
        `SELECT pr.uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor AND COALESCE(pr.status, true)
          ORDER BY pg.name`,
        [req.author.faskesUuid],
      ),
    ),
  ),
);

// Seluruh praktisi aktif faskes (dokter & non-dokter) untuk didaftarkan sebagai petugas radiologi.
rute.get(
  "/referensi/praktisi",
  tangani(async (req, res) =>
    kirim(
      res,
      await query(
        `SELECT pr.uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama, pr.is_doctor
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND COALESCE(pr.status, true)
          ORDER BY pr.is_doctor DESC, pg.name`,
        [req.author.faskesUuid],
      ),
    ),
  ),
);

rute.use("/", hasil);

export default rute;
