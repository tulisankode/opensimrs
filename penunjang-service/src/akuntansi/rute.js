import express from "express";
import { query } from "../db.js";
import { kirim } from "../umum/respons.js";
import { wajibSalahSatu } from "../umum/izin.js";
import { pilihan } from "../sarpras/bersama.js";
import { ARUS_KAS, BUKU_PEMBANTU, JENIS_AKUN, JENIS_JURNAL, KELOMPOK_AKUN, KLASIFIKASI, KLASIFIKASI_KELOMPOK, SALDO_NORMAL, STATUS_EVENT, STATUS_JURNAL, STATUS_PERIODE } from "./bersama.js";
import { JENIS_EVENT } from "./event.js";
import { pengaturan, tanganiAkuntansi } from "./dasar.js";
import { FITUR_AKUNTANSI, fiturAkuntansiAktif, wajibFiturAkuntansi } from "./fitur.js";
import akun from "./akun.js";
import pemetaan from "./pemetaan.js";
import jurnal from "./jurnal.js";
import proses from "./proses.js";
import bukuBesar from "./buku-besar.js";
import periode from "./periode.js";
import laporan from "./laporan.js";
import remunerasi from "./remunerasi/rute.js";

// Akuntansi & Remunerasi — /api/v3/penunjang/akuntansi/... (STD-0031: jurnal otomatis, buku besar, laporan keuangan).
//   /referensi                      pilihan enum, jenis event, pengaturan, penjamin & supplier (dimensi aging), status fitur
//   /akun                           bagan akun (akun.js)          /pemetaan        pemetaan event → akun (pemetaan.js)
//   /jurnal                         jurnal & persetujuan (jurnal.js)
//   /proses, /event                 jurnal otomatis dari transaksi (proses.js)
//   /buku-besar, /neraca-saldo      (buku-besar.js)
//   /periode, /pengaturan           periode & tutup buku (periode.js)
//   /laporan/...                    laporan keuangan (laporan.js; fitur akuntansi_laporan)
//   /remunerasi/...                 jasa pelayanan (remunerasi/rute.js; fitur akuntansi_remunerasi, STD-0032) — menjurnal
//                                   lewat proses.js#jurnalkanEvent (event "jaspel" & "jaspel_bayar")
// Seluruh rute mensyaratkan modul akuntansi aktif (fitur wajib akuntansi_jurnal); izin per aksi diperiksa di tiap rute.
const rute = express.Router();
const MODUL = "Akuntansi & Remunerasi";

rute.use(wajibFiturAkuntansi("akuntansi_jurnal"));

rute.get(
  "/referensi",
  wajibSalahSatu(
    ...["Bagan Akun", "Pemetaan Akun", "Jurnal", "Persetujuan Jurnal", "Buku Besar", "Periode", "Laporan Keuangan"].map((s) => [MODUL, s, "READ"]),
  ),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const fitur = {};
    for (const kode of FITUR_AKUNTANSI) fitur[kode] = await fiturAkuntansiAktif(kode, f);
    const [penjamin, supplier] = await Promise.all([
      query(`SELECT uuid, code AS kode, name AS nama FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]),
      query(`SELECT uuid, code AS kode, name AS nama FROM master_supplier WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]),
    ]);
    kirim(res, {
      kelompok: pilihan(KELOMPOK_AKUN),
      saldo_normal: pilihan(SALDO_NORMAL),
      klasifikasi: pilihan(KLASIFIKASI),
      klasifikasi_kelompok: KLASIFIKASI_KELOMPOK,
      jenis_akun: pilihan(JENIS_AKUN),
      arus_kas: pilihan(ARUS_KAS),
      buku_pembantu: pilihan(BUKU_PEMBANTU),
      jenis_jurnal: pilihan(JENIS_JURNAL),
      status_jurnal: pilihan(STATUS_JURNAL),
      status_event: pilihan(STATUS_EVENT),
      status_periode: pilihan(STATUS_PERIODE),
      jenis_event: Object.entries(JENIS_EVENT).map(([kode, d]) => ({ kode, nama: d.nama, sumber: d.sumber, tersedia: d.tersedia, alasan: d.alasan ?? null })),
      pengaturan: await pengaturan(f),
      penjamin,
      supplier,
      fitur,
    });
  }),
);

rute.use("/remunerasi", wajibFiturAkuntansi("akuntansi_remunerasi"), remunerasi);
rute.use("/akun", akun);
rute.use("/pemetaan", pemetaan);
rute.use("/", proses);
rute.use("/jurnal", jurnal);
rute.use("/", bukuBesar);
rute.use("/", periode);
rute.use("/laporan", wajibFiturAkuntansi("akuntansi_laporan"), laporan);

export default rute;
