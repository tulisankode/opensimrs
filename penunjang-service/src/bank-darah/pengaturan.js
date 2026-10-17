import express from "express";
import { satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { izinBdrs } from "../umum/izin.js";
import { AMBANG_KEDALUWARSA_BAWAAN, angkaOpsional } from "./bersama.js";

// Pengaturan BDRS per faskes (baris tunggal, dibuat otomatis saat pertama kali diakses): ambang peringatan
// kedaluwarsa kantong (hari) & tarif pengolahan darah/crossmatch yang dikirim ke tagihan kunjungan saat serah terima.
const rute = express.Router();

export const ambilPengaturan = async (faskesUuid) => {
  const ada = await satu(`SELECT * FROM bdrs_pengaturan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid]);
  if (ada) return ada;
  return sisipkan("bdrs_pengaturan", {
    faskes_uuid: faskesUuid,
    ambang_kedaluwarsa_hari: AMBANG_KEDALUWARSA_BAWAAN,
    tarif_pengolahan: 0,
    tarif_crossmatch: 0,
  });
};

rute.get(
  "/",
  tangani(async (req, res) => {
    const p = await ambilPengaturan(req.author.faskesUuid);
    kirim(res, {
      uuid: p.uuid,
      ambangKedaluwarsaHari: p.ambang_kedaluwarsa_hari,
      tarifPengolahan: Number(p.tarif_pengolahan),
      tarifCrossmatch: Number(p.tarif_crossmatch),
    });
  }),
);

rute.patch(
  "/",
  izinBdrs("Pengaturan", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const ada = await ambilPengaturan(faskes);
    const ambang = angkaOpsional(b.ambang_kedaluwarsa_hari, "ambang_kedaluwarsa_hari");
    if (ambang !== undefined && ambang !== null && (ambang < 1 || ambang > 90)) throw permintaanSalah("ambang_kedaluwarsa_hari harus 1–90");
    const tarifPengolahan = angkaOpsional(b.tarif_pengolahan, "tarif_pengolahan");
    const tarifCrossmatch = angkaOpsional(b.tarif_crossmatch, "tarif_crossmatch");
    for (const [nama, v] of [["tarif_pengolahan", tarifPengolahan], ["tarif_crossmatch", tarifCrossmatch]])
      if (v !== undefined && v !== null && v < 0) throw permintaanSalah(`${nama} tidak boleh negatif`);
    const hasil = await ubah("bdrs_pengaturan", ada.uuid, faskes, {
      ambang_kedaluwarsa_hari: ambang,
      tarif_pengolahan: tarifPengolahan,
      tarif_crossmatch: tarifCrossmatch,
    });
    kirim(
      res,
      {
        uuid: hasil.uuid,
        ambangKedaluwarsaHari: hasil.ambang_kedaluwarsa_hari,
        tarifPengolahan: Number(hasil.tarif_pengolahan),
        tarifCrossmatch: Number(hasil.tarif_crossmatch),
      },
      "Pengaturan BDRS berhasil disimpan",
    );
  }),
);

export default rute;
