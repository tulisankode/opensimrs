import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import komponen from "./komponen.js";
import pengaturan from "./pengaturan.js";
import permintaan from "./permintaan.js";
import pemeriksaan from "./pemeriksaan.js";
import crossmatch from "./crossmatch.js";
import stok from "./stok.js";
import serahTerima, { buatSerahTerima } from "./serah-terima.js";
import transfusi from "./transfusi.js";
import laporan from "./laporan.js";
import { GOLONGAN_ABO, HASIL_UJI, RHESUS, STATUS_IMLTD, STATUS_PERMINTAAN, STATUS_STOK, SUMBER_KUNJUNGAN, SUMBER_STOK, pilihan } from "./bersama.js";
import { KELOMPOK_KOMPONEN } from "./kompatibilitas.js";

// Bank Darah RS (BDRS) — /api/v3/penunjang/bank-darah/...
//   /komponen                       datamaster komponen darah (PRC/WB/TC/FFP, dapat ditambah faskes)
//   /pengaturan                     ambang peringatan kedaluwarsa & tarif pengolahan/crossmatch per faskes
//   /permintaan                     permintaan darah ruangan: daftar, detail, buat, ubah status, lengkapi
//   /permintaan/:uuid/pemeriksaan   catat golongan ABO/Rhesus & skrining antibodi pasien
//   /permintaan/:uuid/crossmatch    catat hasil crossmatch mayor/minor per kantong kandidat
//   /permintaan/:uuid/serah-terima  buat transaksi serah terima (pilih kantong kompatibel)
//   /serah-terima                   daftar/detail transaksi, konfirmasi dua petugas, batal, kirim ulang tagihan
//   /serah-terima-item/:uuid/transfusi, /transfusi, /transfusi/:uuid/reaksi, /reaksi, /reaksi/:uuid/tindak-lanjut
//   /laporan                        pemakaian, rasio crossmatch-transfusi, stok keluar, reaksi (hemovigilans)
//   /referensi/pilihan|pasien|dokter|lokasi
const rute = express.Router();

rute.use("/komponen", komponen);
rute.use("/pengaturan", pengaturan);
// Rute nested (permintaan/:uuid/...) didaftarkan sebelum rute generik /permintaan agar lebih eksplisit; keduanya
// aman untuk urutan apa pun karena express.Router meneruskan (next()) permintaan yang tidak cocok ke middleware berikutnya.
rute.use("/permintaan/:uuid/pemeriksaan", pemeriksaan);
rute.use("/permintaan/:uuid/crossmatch", crossmatch);
rute.use("/permintaan/:uuid/serah-terima", buatSerahTerima);
rute.use("/permintaan", permintaan);
rute.use("/stok", stok);
rute.use("/serah-terima", serahTerima);
rute.use("/laporan", laporan);
rute.use("/", transfusi);

// Daftar pilihan (enum) untuk form frontend.
rute.get(
  "/referensi/pilihan",
  tangani(async (req, res) =>
    kirim(res, {
      golongan_abo: pilihan(GOLONGAN_ABO),
      rhesus: pilihan(RHESUS),
      hasil_uji: pilihan(HASIL_UJI),
      status_permintaan: pilihan(STATUS_PERMINTAAN),
      status_stok: pilihan(STATUS_STOK),
      status_imltd: pilihan(STATUS_IMLTD),
      kelompok_komponen: pilihan(KELOMPOK_KOMPONEN),
      sumber_kunjungan: pilihan(SUMBER_KUNJUNGAN),
      sumber_stok: pilihan(SUMBER_STOK),
    }),
  ),
);

// Pencarian pasien terdaftar (nama / No. RM / NIK) — dipakai saat mengajukan permintaan dari kunjungan aktif.
rute.get(
  "/referensi/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status IS NOT FALSE";
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

// Dokter aktif faskes (dokter peminta pada formulir permintaan).
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

// Lokasi asal permintaan (ruangan rawat inap/IGD/poli rawat jalan) aktif faskes. ?pelayanan=ranap,igd,rajal
const KODE_PELAYANAN_LOKASI = { rajal: "RJ", ranap: "RI", igd: "IGD" };
rute.get(
  "/referensi/lokasi",
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "l.faskes_uuid = $1 AND l.deleted_at IS NULL AND l.status";
    const pelayanan = String(req.query.pelayanan ?? "")
      .split(",")
      .map((s) => KODE_PELAYANAN_LOKASI[s.trim()])
      .filter(Boolean);
    if (pelayanan.length) {
      p.push(pelayanan);
      w += ` AND l.pelayanan = ANY($${p.length})`;
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND l.name ILIKE $${p.length}`;
    }
    kirim(res, await query(`SELECT l.uuid, l.name, l.pelayanan FROM lokasi l WHERE ${w} ORDER BY l.name LIMIT 100`, p));
  }),
);

export default rute;
