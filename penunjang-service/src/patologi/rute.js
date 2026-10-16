import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import pemeriksaan from "./pemeriksaan.js";
import template from "./template.js";
import petugas from "./petugas.js";
import order from "./order.js";
import kasus from "./kasus.js";
import arsip from "./arsip.js";
import laporan from "./laporan.js";
import { ruteLisPa } from "./lis-pa/lis-pa-rute.js";

// Patologi Anatomi — /api/v3/penunjang/patologi/...
//   /pemeriksaan            datamaster pemeriksaan PA (CRUD, ?jenis=&cari=; /pemeriksaan/jenis)
//   /template               datamaster template laporan (kasus normal/umum; ?untuk_pemeriksaan= untuk dialog laporan)
//   /petugas                dokter Sp.PA & teknisi/analis PA (+ /petugas/pilihan?peran=)
//   /order                  order RME/APS/rujukan: daftar, detail, buat, ubah, validasi (tagihan pa:<uuid>), batal;
//                           /order/kunjungan (RME)
//   /kasus                  worklist kasus: penerimaan jaringan (terima/tolak, nomor PA), makroskopis, mikroskopis,
//                           diagnosis, verifikasi Sp.PA, revisi; /kasus/induk (kasus induk untuk IHK)
//   /arsip                  arsip blok parafin & slide: lokasi rak, pinjam/kembali, riwayat
//   /laporan/kunjungan      rekap kunjungan per jenis, pemeriksaan, pelayanan, hari, diagnosis, dokter, TAT (hari)
//   /referensi/pasien|dokter|icd10   pencarian pasien (order APS), dokter pengirim, kode ICD-10
//   /lis                    Bridging LIS PA: koneksi, mapping, kirim/kirim ulang, cek status, ambil hasil, riwayat laporan
//                           (fitur pa_bridging_lis; titik masuk push hasil tanpa JWT dipasang di server.js)
const rute = express.Router();

rute.use("/pemeriksaan", pemeriksaan);
rute.use("/template", template);
rute.use("/petugas", petugas);
rute.use("/order", order);
rute.use("/kasus", kasus);
rute.use("/arsip", arsip);
rute.use("/laporan", laporan);
rute.use("/lis", ruteLisPa);

rute.get(
  "/referensi/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status IS NOT FALSE"; // pasien non-aktif tidak bisa dipilih
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

// Dokter aktif faskes (dokter pengirim); ?semua=1 → seluruh praktisi (untuk menghubungkan petugas PA).
rute.get(
  "/referensi/dokter",
  tangani(async (req, res) =>
    kirim(
      res,
      await query(
        `SELECT pr.uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama, pr.is_doctor
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND COALESCE(pr.status, true)
            AND ($2::boolean OR pr.is_doctor)
          ORDER BY pr.is_doctor DESC, pg.name`,
        [req.author.faskesUuid, ["1", "true"].includes(String(req.query.semua))],
      ),
    ),
  ),
);

// Kode ICD-10 (tabel diagnosis bersama): ?cari= kode atau nama, maks. 30.
rute.get(
  "/referensi/icd10",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    if (!cari) return kirim(res, []);
    kirim(
      res,
      await query(
        `SELECT code, name FROM diagnosis WHERE deleted_at IS NULL AND COALESCE(status, true) AND (code ILIKE $1 OR name ILIKE $2)
          ORDER BY (code ILIKE $1) DESC, length(code), code LIMIT 30`,
        [`${cari}%`, `%${cari}%`],
      ),
    );
  }),
);

export default rute;
