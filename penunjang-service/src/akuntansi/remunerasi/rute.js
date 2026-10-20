import express from "express";
import { kirim } from "../../umum/respons.js";
import { punyaIzin } from "../../umum/izin.js";
import { pilihan } from "../../sarpras/bersama.js";
import { tanganiAkuntansi } from "../dasar.js";
import {
  JENIS_INDEKS,
  JENIS_LAYANAN,
  KATEGORI,
  METODE_BAYAR,
  MODUL_IZIN,
  PERINGATAN_CONTOH,
  PROFESI,
  SKEMA_CONTOH,
  STATUS_PERIODE,
  STATUS_SKEMA,
  STATUS_SUMBER,
  SUB,
} from "./bersama.js";
import { izinSalahSatu } from "./dasar.js";
import skema from "./skema.js";
import periode from "./periode.js";
import laporan from "./laporan.js";

// Remunerasi — jasa pelayanan (jaspel) dokter & tenaga kesehatan (STD-0032), /api/v3/penunjang/akuntansi/remunerasi/...
// Dipasang di bawah rute Akuntansi (fitur wajib akuntansi_jurnal) dengan gerbang fitur katalog akuntansi_remunerasi.
//   /referensi                   pilihan enum, skema contoh, izin pengguna
//   /skema, /penerima, /praktisi konfigurasi (skema.js)
//   /periode/...                 periode, hitung, verifikasi, persetujuan, pembayaran (periode.js)
//   /slip/..., /rekap            slip & rekap (laporan.js)
// Jurnal ke Akuntansi lewat proses.js#jurnalkanEvent (event jaspel & jaspel_bayar) di dalam transaksi persetujuan/bayar.
const rute = express.Router();

rute.get(
  "/referensi",
  izinSalahSatu(...Object.values(SUB).map((s) => [s, "READ"])),
  tanganiAkuntansi(async (req, res) => {
    const izin = {};
    for (const [kode, sub] of Object.entries(SUB)) izin[kode] = await punyaIzin(req, MODUL_IZIN, sub, "READ");
    kirim(res, {
      status_periode: pilihan(STATUS_PERIODE),
      status_skema: pilihan(STATUS_SKEMA),
      status_sumber: pilihan(STATUS_SUMBER),
      profesi: pilihan(PROFESI),
      kategori: pilihan(KATEGORI),
      jenis_layanan: pilihan(JENIS_LAYANAN),
      jenis_indeks: pilihan(JENIS_INDEKS),
      metode_bayar: pilihan(METODE_BAYAR),
      skema_contoh: SKEMA_CONTOH,
      peringatan_contoh: PERINGATAN_CONTOH,
      izin,
    });
  }),
);

rute.use("/", skema);
rute.use("/", periode);
rute.use("/", laporan);

export default rute;
