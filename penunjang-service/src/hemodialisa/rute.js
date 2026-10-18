import express from "express";
import { tangani, kirim } from "../umum/respons.js";
import { wajibSalahSatu } from "../umum/izin.js";
import datamaster from "./datamaster.js";
import registrasi from "./registrasi.js";
import jadwal from "./jadwal.js";
import resep from "./resep.js";
import sesi from "./sesi.js";
import pemakaian from "./pemakaian.js";
import laporan from "./laporan.js";
import hdis from "./hdis/rute.js";
import { JENIS_HD, KOMPLIKASI, METODE_ADEKUASI, PARAMETER, POLA_JADWAL, STATUS_JADWAL, STATUS_MESIN, STATUS_SESI } from "./bersama.js";
import { kodeTarifSesi } from "./tagihan.js";

// Unit Hemodialisa (STD-0033) — /api/v3/penunjang/hemodialisa/...
//   /mesin, /shift, /dializer-aturan, /item-medis   datamaster (Datamaster › Mesin & Shift / Aturan Reuse Dializer)
//   /pasien, /registrasi                            registrasi HD akut/kronis
//   /jadwal, /antrean, /pengingat                   jadwal per mesin × shift (satu kali/rutin), antrean harian, pengingat
//   /resep                                          resep HD draft → sah
//   /sesi                                           buka, asesmen pra-HD, mulai, observasi, koreksi, tutup, adekuasi, tagihan
//   /dializer, /sesi/:uuid/pemakaian                dializer per pasien (reuse terbatas) & pemakaian dializer/BHP
//   /laporan                                        tindakan, utilisasi mesin, komplikasi, adekuasi
//   /hdis                                           bridging HDIS (fitur hd_bridging_hdis): koneksi, pemetaan mesin, riwayat
// Titik masuk HDIS tanpa JWT ada di hdis/push-rute.js (dipasang di server.js).
const rute = express.Router();

const izinBaca = wajibSalahSatu(
  ["Hemodialisa", "Registrasi & Jadwal", "READ"],
  ["Hemodialisa", "Resep HD", "READ"],
  ["Hemodialisa", "Sesi HD", "READ"],
  ["Hemodialisa", "Pemakaian BHP", "READ"],
  ["Hemodialisa", "Laporan Hemodialisa", "READ"],
);

// Referensi form (enum, skema parameter + satuan, kategori komplikasi, konvensi kode tarif).
rute.get(
  "/referensi",
  izinBaca,
  tangani(async (_req, res) =>
    kirim(res, {
      jenis_hd: JENIS_HD,
      pola_jadwal: POLA_JADWAL,
      status_jadwal: STATUS_JADWAL,
      status_sesi: STATUS_SESI,
      status_mesin: STATUS_MESIN,
      parameter: Object.entries(PARAMETER).map(([kode, p]) => ({ kode, ...p })),
      komplikasi: Object.entries(KOMPLIKASI).map(([kode, label]) => ({ kode, label })),
      metode_adekuasi: METODE_ADEKUASI,
      kode_tarif: { kronis: kodeTarifSesi("kronis"), akut: kodeTarifSesi("akut") },
    }),
  ),
);

rute.use("/hdis", hdis);
rute.use("/", datamaster);
rute.use("/", registrasi);
rute.use("/", jadwal);
rute.use("/", resep);
rute.use("/", sesi);
rute.use("/", pemakaian);
rute.use("/", laporan);

export default rute;
