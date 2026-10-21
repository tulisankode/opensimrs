import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import pacu from "./pacu.js";
import ruang from "./ruang.js";
import order from "./order.js";
import jadwal from "./jadwal.js";
import praoperasi from "./praoperasi.js";
import checklist from "./checklist.js";
import laporan from "./laporan.js";
import pemakaian from "./pemakaian.js";
import rekap from "./rekap.js";

// Kamar Operasi — /api/v3/penunjang/kamar-operasi/...
//   /ruang                  master ruang OK (Datamaster)
//   /orders                 order operasi dari Plan asesmen RJ/RI/IGD: daftar tunggu (cito diprioritaskan), detail,
//                           buat, klarifikasi, lengkapi; /orders/:uuid/jadwal (penjadwalan)
//   /jadwal                 daftar & detail jadwal; jadwal-ulang, batal, selesai
//   /jadwal/:uuid/praoperasi         asesmen pra-bedah/pra-anestesi, penandaan lokasi
//   /jadwal/:uuid/checklist/:tahap   checklist keselamatan bedah WHO (sign-in/time-out/sign-out)
//   /jadwal/:uuid/laporan-operasi    laporan operasi (draf/final/revisi) & finalisasi tagihan
//   /jadwal/:uuid/laporan-anestesi   laporan anestesi & skor Aldrete
//   /jadwal/:uuid/pemakaian          pemakaian BHP/obat depo OK
//   /laporan/rekap          rekap operasi per periode, operator, kelas operasi & persentase pembatalan
//   /referensi/dokter|icd9cm|icd10|item-medis|lokasi-stok  data pendukung form (tim operasi, tindakan/diagnosis,
//                           item medis & lokasi stok depo OK untuk pemakaian BHP — dipilih, bukan diketik UUID)
const rute = express.Router();

rute.use("/pacu", pacu);
rute.use("/ruang", ruang);
rute.use("/orders", order);
rute.use("/", jadwal);
rute.use("/", praoperasi);
rute.use("/", checklist);
rute.use("/", laporan);
rute.use("/", pemakaian);
rute.use("/", rekap);

// Dokter & petugas aktif faskes untuk tim operasi; ?semua=1 → seluruh praktisi (operator tetap disaring dokter di UI).
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

// Kode ICD-9-CM (tindakan/prosedur) untuk rencana tindakan order operasi. ?cari= kode atau nama, maks. 30.
rute.get(
  "/referensi/icd9cm",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    if (!cari) return kirim(res, []);
    kirim(
      res,
      await query(
        `SELECT code, name FROM icd9 WHERE deleted_at IS NULL AND status AND (code ILIKE $1 OR name ILIKE $2)
          ORDER BY (code ILIKE $1) DESC, length(code), code LIMIT 30`,
        [`${cari}%`, `%${cari}%`],
      ),
    );
  }),
);

// Kode ICD-10 (diagnosis) untuk diagnosis order operasi. ?cari= kode atau nama, maks. 30.
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

// Item medis aktif faskes untuk pemakaian BHP/obat depo OK (KF-1/KF-4). ?cari= kode atau nama, maks. 30.
rute.get(
  "/referensi/item-medis",
  izinOk("Pemakaian BHP", "READ"),
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim().slice(0, 100);
    kirim(
      res,
      await query(
        `SELECT uuid, code, name FROM item_medis
          WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status AND (code ILIKE $2 OR name ILIKE $3)
          ORDER BY (code ILIKE $2) DESC, name LIMIT 30`,
        [req.author.faskesUuid, `${cari}%`, `%${cari}%`],
      ),
    );
  }),
);

// Mengikuti validasi pemakaian: lokasi aktif berjenis depo, tanpa menebak identitas depo dari namanya.
rute.get(
  "/referensi/lokasi-stok",
  izinOk("Pemakaian BHP", "READ"),
  tangani(async (req, res) =>
    kirim(
      res,
      await query(
        `SELECT uuid, code, name FROM lokasi_stok
          WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status AND jenis_lokasi = 'depo'
          ORDER BY name`,
        [req.author.faskesUuid],
      ),
    ),
  ),
);

export default rute;
