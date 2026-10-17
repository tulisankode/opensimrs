import express from "express";
import { tangani, kirim } from "../umum/respons.js";
import { wajibSalahSatu } from "../umum/izin.js";
import donor from "./donor.js";
import aftap from "./aftap.js";
import imltd from "./imltd.js";
import komponen from "./komponen.js";
import distribusi from "./distribusi.js";
import pelaporan from "./pelaporan.js";
import pengaturan from "./pengaturan.js";
import {
  ALASAN_MUSNAH, GOLONGAN_DARAH, HASIL_IMLTD, JENIS_KELAMIN, JENIS_KOMPONEN, JENIS_LAPORAN, PARAMETER_IMLTD,
  PENERIMA_TIPE, REAKSI_DONOR, RHESUS, STATUS_AKTIF_DONOR, STATUS_DISTRIBUSI, STATUS_KANTONG, STATUS_KOMPONEN,
  STATUS_PERMINTAAN, STATUS_SELEKSI, pilihan,
} from "./bersama.js";

// UTD / UPTD Produksi Darah — /api/v3/penunjang/utd/...
//   /donor                    rekrutmen & seleksi donor (KF-1..7): daftar, detail+jejak, riwayat, seleksi
//   /aftap                    pengambilan darah (KF-8..12): daftar, buat, jejak vein-to-vein
//   /imltd/worklist, /aftap/:uuid/imltd(/konfirmasi), /aftap/:uuid/pelepasan   uji saring IMLTD (KF-13..19)
//   /komponen, /aftap/:uuid/komponen    pengolahan & stok komponen (KF-20..25)
//   /permintaan, /distribusi, /pemusnahan   penyimpanan & distribusi (KF-26..32)
//   /laporan                  pelaporan Dinkes/Kemenkes (KF-33..37)
//   /pengaturan               parameter klinis per faskes (interval minimal donor, dsb.)
const rute = express.Router();

rute.use("/donor", donor);
rute.use("/aftap", aftap);
rute.use("/pengaturan", pengaturan);
rute.use("/laporan", pelaporan);
rute.use("/", imltd);
rute.use("/", komponen);
rute.use("/", distribusi);

// Daftar pilihan (enum) untuk form frontend: cukup salah satu hak READ di modul UTD.
rute.get(
  "/referensi/pilihan",
  wajibSalahSatu(
    ["UTD", "Donor", "READ"], ["UTD", "Aftap", "READ"], ["UTD", "IMLTD", "READ"], ["UTD", "Komponen", "READ"],
    ["UTD", "Distribusi", "READ", "Permintaan"], ["UTD", "Distribusi", "READ", "Distribusi"], ["UTD", "Distribusi", "READ", "Pemusnahan"],
    ["UTD", "Laporan UTD", "READ"],
  ),
  tangani(async (req, res) =>
    kirim(res, {
      jenis_kelamin: pilihan(JENIS_KELAMIN),
      golongan_darah: pilihan(GOLONGAN_DARAH),
      rhesus: pilihan(RHESUS),
      status_aktif_donor: pilihan(STATUS_AKTIF_DONOR),
      status_seleksi: pilihan(STATUS_SELEKSI),
      reaksi_donor: pilihan(REAKSI_DONOR),
      status_kantong: pilihan(STATUS_KANTONG),
      parameter_imltd: pilihan(PARAMETER_IMLTD),
      hasil_imltd: pilihan(HASIL_IMLTD),
      jenis_komponen: pilihan(JENIS_KOMPONEN),
      status_komponen: pilihan(STATUS_KOMPONEN),
      penerima_tipe: pilihan(PENERIMA_TIPE),
      status_permintaan: pilihan(STATUS_PERMINTAAN),
      status_distribusi: pilihan(STATUS_DISTRIBUSI),
      alasan_musnah: pilihan(ALASAN_MUSNAH),
      jenis_laporan: pilihan(JENIS_LAPORAN),
    }),
  ),
);

export default rute;
