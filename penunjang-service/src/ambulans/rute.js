import express from "express";
import armada from "./armada.js";
import kru from "./kru.js";
import permintaan from "./permintaan.js";
import penugasan from "./penugasan.js";
import perjalanan from "./perjalanan.js";
import tarif from "./tarif.js";
import tagihan from "./tagihan.js";
import laporan from "./laporan.js";

// Manajemen Ambulans (STD-0024) — /api/v3/penunjang/ambulans/...
//   /armada                                   master armada, status, riwayat servis
//   /kru                                      master kru & jadwal jaga
//   /permintaan                               permintaan layanan & pembatalan
//   /permintaan/:uuid/penugasan                penetapan armada & kru (penugasan.js)
//   /penugasan                                worklist penugasan aktif
//   /penugasan/:uuid/batal                     pembatalan penugasan (penugasan.js)
//   /penugasan/:uuid/perjalanan                mulai perjalanan (perjalanan.js)
//   /perjalanan/:uuid/tahap|/selesai           pencatatan tahap & penyelesaian (perjalanan.js)
//   /tarif                                     tarif layanan
//   /biaya/:uuid/teruskan, /kuitansi           penerusan biaya & kuitansi umum (tagihan.js)
//   /laporan                                   rekap layanan, respons, jarak/BBM, pendapatan
const rute = express.Router();

rute.use("/armada", armada);
rute.use("/kru", kru);
rute.use("/permintaan", permintaan);
rute.use(penugasan);
rute.use(perjalanan);
rute.use("/tarif", tarif);
rute.use(tagihan);
rute.use("/laporan", laporan);

export default rute;
