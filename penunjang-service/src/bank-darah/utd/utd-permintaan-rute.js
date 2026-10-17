import express from "express";
import { tangani, kirim } from "../../umum/respons.js";
import { izinBdrs } from "../../umum/izin.js";
import { wajibFiturBdrsBridgingAktif } from "./izin.js";
import { kirimPermintaanKeUtd, ambilStatusPermintaan } from "./utd-service.js";

// Dua aksi bridging yang menempel pada satu permintaan darah — dipasang sebagai /permintaan/:uuid/... di
// bank-darah/rute.js (pola sama dengan /permintaan/:uuid/pemeriksaan|crossmatch|serah-terima). Aksi lain (koneksi,
// mapping, pengiriman, kantong) ada di utd-rute.js di bawah /utd.
const rute = express.Router({ mergeParams: true });
rute.use(wajibFiturBdrsBridgingAktif);

rute.post(
  "/kirim-utd",
  izinBdrs("Permintaan Darah", "UPDATE"),
  tangani(async (req, res) => {
    try {
      const hasil = await kirimPermintaanKeUtd(req.author.faskesUuid, req.params.uuid, { koneksiUuid: req.body?.koneksi_uuid || null, pengguna: req.author.username ?? null });
      kirim(res, hasil, `Permintaan dikirim ke UTD ${hasil.koneksi} (No. Registrasi ${hasil.no_registrasi})`);
    } catch (error) {
      // Lebih dari satu koneksi aktif tanpa bawaan (F12/KT-18): kembalikan daftar koneksi agar petugas memilih.
      if (error?.koneksi) return res.status(error.status).json({ message: error.message, payload: { koneksi: error.koneksi } });
      throw error;
    }
  }),
);

rute.post(
  "/ambil-status-utd",
  izinBdrs("Permintaan Darah", "READ"),
  tangani(async (req, res) => kirim(res, await ambilStatusPermintaan(req.author.faskesUuid, req.params.uuid, req.body?.koneksi_uuid || null), "Status terbaru diambil dari UTD")),
);

export default rute;
