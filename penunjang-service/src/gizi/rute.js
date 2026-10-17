import express from "express";
import { tangani, kirim } from "../umum/respons.js";
import { INSTRUMEN, WAKTU_MAKAN, LABEL_WAKTU_MAKAN } from "./bersama.js";
import { ruanganAktif } from "./rawat_inap.js";
import master from "./master.js";
import skrining from "./skrining.js";
import asesmen from "./asesmen.js";
import order from "./order.js";
import distribusi from "./distribusi.js";
import laporan from "./laporan.js";

// Gizi — /api/v3/penunjang/gizi/...
//   /master/{diet,bentuk-makanan,standar-porsi}   datamaster gizi (CRUD)
//   /rawat-inap/belum-skrining                    worklist skrining (perawat)
//   /rawat-inap/:uuid/skrining                    isi skrining (POST); /skrining/:uuid (GET detail)
//   /asesmen/daftar-kerja                         worklist ahli gizi (pasien skrining berisiko belum diasesmen)
//   /rawat-inap/:uuid/asesmen                     asuhan gizi/PAGT (GET riwayat, POST); /asesmen/:uuid (PATCH)
//   /rawat-inap/:uuid/order-diet                  order diet DPJP (GET order berlaku+alergi+riwayat, POST); /order-diet/:uuid (PATCH)
//   /distribusi                                   daftar distribusi makan + rekap porsi per ruangan & waktu makan
//   /laporan                                      jumlah pasien per diet & cakupan skrining
const rute = express.Router();

rute.use("/master", master);
rute.use(skrining);
rute.use(asesmen);
rute.use(order);
rute.use("/distribusi", distribusi);
rute.use("/laporan", laporan);

// Referensi form: instrumen skrining (+pertanyaan), waktu makan, dan ruangan (bangsal) yang sedang berisi pasien.
rute.get(
  "/referensi",
  tangani(async (req, res) => {
    const ruangan = await ruanganAktif(req.author.faskesUuid);
    kirim(res, {
      instrumen: Object.entries(INSTRUMEN).map(([kode, v]) => ({ kode, label: v.label, pertanyaan: v.pertanyaan })),
      waktu_makan: WAKTU_MAKAN.map((kode) => ({ kode, label: LABEL_WAKTU_MAKAN[kode] })),
      ruangan,
    });
  }),
);

export default rute;
