import { query, satu, sisipkan, ubah, sekarang } from "../../db.js";
import { permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { ramah, teks } from "../bersama.js";
import { ambilKoneksi } from "./koneksi.js";

// Pemetaan mesin HD SIMRS → kode mesin di HDIS per koneksi. Dipakai saat mengirim jadwal (kode_mesin_hdis) dan saat
// menerima parameter (bila HDIS menyertakan kode mesin, harus cocok dengan mesin jadwal — mencegah salah lekat sesi).
export const daftarPeta = async (faskesUuid, koneksiUuid) => {
  if (!koneksiUuid) throw permintaanSalah("koneksi_uuid wajib diisi");
  await ambilKoneksi(faskesUuid, koneksiUuid);
  return query(
    `SELECT m.uuid AS mesin_uuid, m.kode, m.nama, m.status, p.uuid, p.kode_mesin_hdis, p.updated_at
       FROM hd_mesin m LEFT JOIN hd_hdis_peta_mesin p ON p.mesin_uuid = m.uuid AND p.koneksi_uuid = $2 AND p.deleted_at IS NULL
      WHERE m.faskes_uuid = $1 AND m.deleted_at IS NULL ORDER BY m.kode`,
    [faskesUuid, koneksiUuid],
  );
};

export const petaMesin = (koneksiUuid, mesinUuid) =>
  satu(`SELECT kode_mesin_hdis FROM hd_hdis_peta_mesin WHERE koneksi_uuid = $1 AND mesin_uuid = $2 AND deleted_at IS NULL`, [koneksiUuid, mesinUuid]);

// kode_mesin_hdis kosong → hapus pemetaan.
export const simpanPeta = async (faskesUuid, { koneksi_uuid, mesin_uuid, kode_mesin_hdis }, pengguna) => {
  if (!koneksi_uuid || !mesin_uuid) throw permintaanSalah("koneksi_uuid dan mesin_uuid wajib diisi");
  await ambilKoneksi(faskesUuid, koneksi_uuid);
  const mesin = await satu(`SELECT uuid, kode FROM hd_mesin WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [mesin_uuid, faskesUuid]);
  if (!mesin) throw tidakDitemukan("Mesin HD");
  const kode = teks(kode_mesin_hdis, 60);
  const ada = await satu(`SELECT uuid FROM hd_hdis_peta_mesin WHERE koneksi_uuid = $1 AND mesin_uuid = $2 AND deleted_at IS NULL`, [koneksi_uuid, mesin.uuid]);
  if (!kode) {
    if (ada) await query(`UPDATE hd_hdis_peta_mesin SET deleted_at = $2, updated_at = $2 WHERE uuid = $1`, [ada.uuid, sekarang()]);
    return { mesin_uuid: mesin.uuid, kode_mesin_hdis: null };
  }
  const pesan = `Kode mesin HDIS ${kode} sudah dipetakan ke mesin lain pada koneksi ini`;
  if (ada) return ubah("hd_hdis_peta_mesin", ada.uuid, faskesUuid, { kode_mesin_hdis: kode, diubah_oleh: pengguna }).catch((e) => ramah(e, pesan));
  return sisipkan("hd_hdis_peta_mesin", { faskes_uuid: faskesUuid, koneksi_uuid, mesin_uuid: mesin.uuid, kode_mesin_hdis: kode, diubah_oleh: pengguna }).catch((e) => ramah(e, pesan));
};
