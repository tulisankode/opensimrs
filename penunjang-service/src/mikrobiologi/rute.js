import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { BENTUK, GRAM, JENIS_PEMERIKSAAN, KELOMPOK, PENANDA, PEWARNAAN, SPESIMEN, STATUS_KULTUR, pilihan } from "./bersama.js";
import { pemeriksaan, organisme, antibiotik, panel } from "./master.js";
import order from "./order.js";
import hasil from "./hasil.js";
import laporan from "./laporan.js";
import lis from "./lis-rute.js";

// Mikrobiologi Klinik — /api/v3/penunjang/mikrobiologi/...
//   /pemeriksaan | /organisme | /antibiotik   datamaster (CRUD, ?cari=&status=; pemeriksaan ?jenis=&spesimen=; organisme ?gram=&kelompok=)
//   /panel                    panel antibiotik per kelompok organisme: GET (ringkas / ?kelompok=), GET /organisme/:uuid, PUT /:kelompok
//   /order                    order RME/APS: daftar, detail, buat, ubah, validasi (tagihan mikro:<uuid>), batal; /order/kunjungan (RME)
//   /worklist, /item/:uuid    penerimaan/penolakan spesimen, input hasil (pewarnaan, kultur, isolat, AST), laporan sementara,
//                             verifikasi Sp.MK (final), buka verifikasi
//   /laporan/kunjungan        rekap kunjungan, positivitas kultur, organisme terbanyak, TAT (hari)
//   /laporan/antibiogram      antibiogram kumulatif (%S per organisme × antibiotik, jumlah isolat)
//   /referensi/pilihan|pasien|dokter
//   /lis                      Bridging LIS Mikrobiologi (fitur mikro_bridging_lis): koneksi, mapping, kirim/tarik hasil, status kiriman
const rute = express.Router();

rute.use("/pemeriksaan", pemeriksaan);
rute.use("/organisme", organisme);
rute.use("/antibiotik", antibiotik);
rute.use("/panel", panel);
rute.use("/order", order);
rute.use("/laporan", laporan);
rute.use("/lis", lis);

// Daftar pilihan (enum) untuk form frontend.
rute.get(
  "/referensi/pilihan",
  tangani(async (req, res) =>
    kirim(res, {
      spesimen: pilihan(SPESIMEN),
      kelompok: pilihan(KELOMPOK),
      gram: pilihan(GRAM),
      bentuk: pilihan(BENTUK),
      jenis: pilihan(JENIS_PEMERIKSAAN),
      pewarnaan: pilihan(PEWARNAAN),
      status_kultur: pilihan(STATUS_KULTUR),
      penanda: pilihan(PENANDA),
    }),
  ),
);

// Pencarian pasien terdaftar untuk order APS (nama / No. RM / NIK).
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

// Dokter aktif faskes (dokter pengirim & dokter Sp.MK pemverifikasi; dokter bergelar Sp.MK diurutkan lebih dulu).
rute.get(
  "/referensi/dokter",
  tangani(async (req, res) =>
    kirim(
      res,
      await query(
        `SELECT pr.uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama,
                COALESCE(pg.last_title, '') ~* 'Sp\\.?\\s*MK' AS sp_mk
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor AND COALESCE(pr.status, true)
          ORDER BY sp_mk DESC, pg.name`,
        [req.author.faskesUuid],
      ),
    ),
  ),
);

rute.use("/", hasil);

export default rute;
