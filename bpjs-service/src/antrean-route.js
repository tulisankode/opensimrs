import express from "express";
import { konfigurasiTersamar, simpanKonfigurasi } from "./antrean.js";
import {
  ambilAntrean, statusAntrean, sisaAntrean, batalAntrean, checkIn, pasienBaru, jadwalOperasi,
  monitoring, detailBooking, kirimUlang,
} from "./antrean-service.js";
import {
  validasiStatusAntrean, validasiAmbilAntrean, validasiBatalAntrean, validasiCheckIn, validasiSisaAntrean, validasiPasienBaru,
} from "./validasi-antrean.js";
import { terbitkanTokenWs, wajibTokenWs } from "./antrean-auth.js";

const tangani = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    res.status(status).json({ message: error.message, detail: error.detail });
  });
const kirim = (res, payload, message = "Data berhasil ditampilkan") => res.json({ message, payload });

// --- Rute internal (JWT, izin "Antrian > Antrean Online BPJS") — dipasang di rute.js di bawah wajibLogin. ------
export const ruteInternal = express.Router();
const fk = (req) => req.author.faskesUuid;

ruteInternal.get("/konfigurasi", tangani(async (req, res) => kirim(res, await konfigurasiTersamar(fk(req)))));
ruteInternal.put(
  "/konfigurasi",
  tangani(async (req, res) => kirim(res, await simpanKonfigurasi(fk(req), req.body ?? {}), "Konfigurasi Antrean BPJS disimpan"))
);
ruteInternal.get(
  "/monitoring",
  tangani(async (req, res) => {
    const { data, pagination } = await monitoring(fk(req), req.query);
    res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
  })
);
ruteInternal.get("/booking/:kodeBooking", tangani(async (req, res) => kirim(res, await detailBooking(fk(req), req.params.kodeBooking))));
ruteInternal.post(
  "/booking/:kodeBooking/kirim-ulang",
  tangani(async (req, res) => kirim(res, await kirimUlang(fk(req), req.params.kodeBooking, req.body ?? {}), "Percobaan kirim ulang selesai"))
);

// --- Rute WS Antrean (dipanggil BPJS/Mobile JKN) — dipasang terpisah di server.js, TANPA wajibLogin JWT. --------
// Autentikasi: /token memeriksa tanda tangan Cons ID/Secret Key; rute lain wajib token hasil /token (wajibTokenWs).
// faskesUuid selalu dari token (req.faskesUuidWs), tidak pernah dari body/query (KF-15/KT-11).
export const ruteWs = express.Router();

ruteWs.post("/token", tangani(terbitkanTokenWs));
ruteWs.use(wajibTokenWs);

ruteWs.post(
  "/status-antrean",
  tangani(async (req, res) => kirim(res, await statusAntrean(req.faskesUuidWs, validasiStatusAntrean(req.body))))
);
ruteWs.post(
  "/ambil-antrean",
  tangani(async (req, res) => kirim(res, await ambilAntrean(req.faskesUuidWs, validasiAmbilAntrean(req.body)), "Antrean berhasil dibuat"))
);
ruteWs.post(
  "/sisa-antrean",
  tangani(async (req, res) => kirim(res, await sisaAntrean(req.faskesUuidWs, validasiSisaAntrean(req.body))))
);
ruteWs.post(
  "/batal-antrean",
  tangani(async (req, res) => kirim(res, await batalAntrean(req.faskesUuidWs, validasiBatalAntrean(req.body)), "Antrean dibatalkan"))
);
ruteWs.post("/check-in", tangani(async (req, res) => kirim(res, await checkIn(req.faskesUuidWs, validasiCheckIn(req.body)), "Check-in berhasil")));
ruteWs.post(
  "/pasien-baru",
  tangani(async (req, res) => kirim(res, await pasienBaru(req.faskesUuidWs, validasiPasienBaru(req.body))))
);
ruteWs.get("/jadwal-operasi", tangani(async (req, res) => kirim(res, await jadwalOperasi(req.faskesUuidWs, req.query))));
