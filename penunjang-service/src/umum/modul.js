import { satu } from "../db.js";

// Status aktif modul (katalog Manajemen Modul) untuk sebuah faskes: override eksplisit > preset segmen.
// Query yang sama dipakai migrasi izin_kamar_operasi.cjs; dipertahankan konsisten agar hasil sama di runtime & migrasi.
export const modulAktif = async (kodeModul, faskesUuid) => {
  const override = await satu(`SELECT aktif FROM faskes_modul_override WHERE faskes_uuid = $1 AND modul_kode = $2`, [faskesUuid, kodeModul]);
  if (override) return !!override.aktif;
  const preset = await satu(
    `SELECT 1 FROM faskes_segmen fs JOIN preset_segmen_modul p ON p.segmen_kode = fs.segmen_kode
      WHERE fs.faskes_uuid = $1 AND p.modul_kode = $2`,
    [faskesUuid, kodeModul],
  );
  return !!preset;
};
