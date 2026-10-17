import express from "express";
import { satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { izinUtd } from "../umum/izin.js";

// Parameter klinis UTD yang dikonfigurasi per faskes (bukan dihardcode di kode), mis. interval minimal antar-donor.
// Nilai bawaan wajib ditinjau pemilik proses sesuai pedoman resmi (PMI/Kemenkes) sebelum dipakai produksi.
const rute = express.Router();

export const pengaturanUtd = async (faskesUuid) => {
  const ada = await satu(`SELECT * FROM utd_pengaturan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid]);
  if (ada) return ada;
  return sisipkan("utd_pengaturan", { faskes_uuid: faskesUuid });
};

rute.get(
  "/",
  tangani(async (req, res) => kirim(res, await pengaturanUtd(req.author.faskesUuid))),
);

rute.put(
  "/",
  izinUtd("Donor", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const interval = Number(req.body?.interval_minimal_hari);
    if (!Number.isInteger(interval) || interval <= 0) throw permintaanSalah("interval_minimal_hari harus bilangan bulat positif");
    const ada = await pengaturanUtd(faskes);
    const t = await ubah("utd_pengaturan", ada.uuid, faskes, { interval_minimal_hari: interval });
    kirim(res, t, "Pengaturan UTD disimpan");
  }),
);

export default rute;
