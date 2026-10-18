import express from "express";
import { tangani, kirim } from "../../umum/respons.js";
import { izinBdrs } from "../../umum/izin.js";
import { wajibFiturBdrsBridgingAktif } from "./izin.js";
import { kirimPermintaanKeUtd, ambilStatusPermintaan } from "./utd-service.js";

// Dua aksi bridging yang menempel pada satu permintaan darah — dipasang sebagai /permintaan/:uuid/... di
// bank-darah/rute.js (pola sama dengan /permintaan/:uuid/pemeriksaan|crossmatch|serah-terima). Aksi lain (koneksi,
// mapping, pengiriman, kantong) ada di utd-rute.js di bawah /utd.
// Pemeriksaan fitur bdrs_bridging dipasang PER RUTE (bukan rute.use): router ini dilewati oleh SEMUA permintaan
// /permintaan/:uuid/* dan /permintaan/kunjungan, sehingga rute.use akan ikut menolak rute permintaan biasa saat fitur mati.
const rute = express.Router({ mergeParams: true });

/**
 * Jawaban HTTP hasil kirim/kirim ulang ke UTD: penolakan pasti dari UTD (status `gagal`) dijawab 502 dengan pesan aman
 * (payload tetap berisi status) agar UI menampilkan galat, bukan "Permintaan dikirim…". `tidak_pasti` tetap 200 dengan
 * pesan yang meminta Cek Status (permintaan mungkin sudah sampai ke UTD).
 */
export const jawabHasilKirim = (res, hasil, pesanBerhasil) => {
  if (hasil.status === "gagal") {
    return res.status(502).json({ message: `Pengiriman ke UTD ${hasil.koneksi} gagal: ${String(hasil.pesan ?? "").slice(0, 300)}`, payload: hasil });
  }
  return kirim(res, hasil, hasil.status === "tidak_pasti" ? hasil.pesan : pesanBerhasil);
};

rute.post(
  "/kirim-utd",
  wajibFiturBdrsBridgingAktif,
  izinBdrs("Permintaan Darah", "UPDATE"),
  tangani(async (req, res) => {
    try {
      const hasil = await kirimPermintaanKeUtd(req.author.faskesUuid, req.params.uuid, { koneksiUuid: req.body?.koneksi_uuid || null, pengguna: req.author.username ?? null });
      jawabHasilKirim(res, hasil, `Permintaan dikirim ke UTD ${hasil.koneksi} (No. Registrasi ${hasil.no_registrasi})`);
    } catch (error) {
      // Lebih dari satu koneksi aktif tanpa bawaan (F12/KT-18): kembalikan daftar koneksi agar petugas memilih.
      if (error?.koneksi) return res.status(error.status).json({ message: error.message, payload: { koneksi: error.koneksi } });
      throw error;
    }
  }),
);

// Ambil Status menulis hasil & kantong UTD ke database → izin UPDATE (bukan READ).
rute.post(
  "/ambil-status-utd",
  wajibFiturBdrsBridgingAktif,
  izinBdrs("Permintaan Darah", "UPDATE"),
  tangani(async (req, res) => kirim(res, await ambilStatusPermintaan(req.author.faskesUuid, req.params.uuid, req.body?.koneksi_uuid || null), "Status terbaru diambil dari UTD")),
);

export default rute;
