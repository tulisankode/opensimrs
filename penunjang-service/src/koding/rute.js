import express from "express";
import worklist from "./worklist.js";
import klarifikasi from "./klarifikasi.js";
import checklist from "./checklist.js";
import peminjaman from "./peminjaman.js";
import retensi from "./retensi.js";
import laporan from "./laporan.js";

// Koding Rekam Medis — /api/v3/penunjang/koding/...
//   /worklist, /kunjungan/:tipe/:uuid(...)   worklist, detail, koding ICD-10/ICD-9-CM, finalisasi siap klaim
//   /kunjungan/:tipe/:uuid/klarifikasi, /klarifikasi/:uuid/(jawaban|tutup)   klarifikasi koder ↔ DPJP
//   /checklist/*, /kunjungan/:tipe/:uuid/checklist   checklist kelengkapan rekam medis
//   /peminjaman                               peminjaman & pengembalian berkas fisik
//   /retensi/*                                jenis berkas, daftar retensi, usulan & keputusan pemusnahan
//   /laporan/*                                indeks, sepuluh besar, RL, produktivitas koder, dasbor
const rute = express.Router();

rute.use(worklist);
rute.use(klarifikasi);
rute.use(checklist);
rute.use(peminjaman);
rute.use(retensi);
rute.use(laporan);

export default rute;
