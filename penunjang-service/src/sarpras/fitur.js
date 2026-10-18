import { satu } from "../db.js";

// Status modul/fitur katalog (Manajemen Modul) untuk faskes, dibaca langsung dari database bersama dengan aturan
// yang sama seperti setting-service/src/modul/katalog-modul.js (lihat juga bank-darah/utd/izin.js#fiturAktifFaskes):
//   modul aktif = tersedia ∧ (inti ∨ override faskes ∨ preset segmen ∨ faskes tanpa segmen dikenal);
//   fitur aktif = tersedia ∧ modul induk (& modul syarat) aktif ∧ (wajib ∨ override ∨ tidak dimatikan preset segmen).
// Fail-closed: galat membaca database → dianggap nonaktif.
const segmenFaskes = async (faskesUuid) =>
  (await satu(`SELECT fs.segmen_kode FROM faskes_segmen fs JOIN ref_segmen s ON s.kode = fs.segmen_kode WHERE fs.faskes_uuid = $1`, [faskesUuid]))
    ?.segmen_kode ?? null;

const hitungModulAktif = async (kode, faskesUuid, segmen) => {
  const modul = await satu(`SELECT inti, tersedia FROM ref_modul WHERE kode = $1`, [kode]);
  if (!modul?.tersedia) return false;
  if (modul.inti) return true;
  const override = await satu(`SELECT aktif FROM faskes_modul_override WHERE faskes_uuid = $1 AND modul_kode = $2`, [faskesUuid, kode]);
  if (override) return !!override.aktif;
  if (!segmen) return true;
  return !!(await satu(`SELECT 1 FROM preset_segmen_modul WHERE segmen_kode = $1 AND modul_kode = $2`, [segmen, kode]));
};

export const modulKatalogAktif = async (kode, faskesUuid) => {
  try {
    return await hitungModulAktif(kode, faskesUuid, await segmenFaskes(faskesUuid));
  } catch (error) {
    console.warn(`[sarpras] Gagal membaca status modul ${kode}:`, error.message);
    return false;
  }
};

export const fiturSarprasAktif = async (kodeFitur, faskesUuid) => {
  try {
    const fitur = await satu(`SELECT modul_kode, modul_syarat, wajib, tersedia FROM ref_fitur WHERE kode = $1`, [kodeFitur]);
    if (!fitur?.tersedia) return false;
    const segmen = await segmenFaskes(faskesUuid);
    if (!(await hitungModulAktif(fitur.modul_kode, faskesUuid, segmen))) return false;
    if (fitur.modul_syarat && !(await hitungModulAktif(fitur.modul_syarat, faskesUuid, segmen))) return false;
    if (fitur.wajib) return true;
    const override = await satu(`SELECT aktif FROM faskes_fitur_override WHERE faskes_uuid = $1 AND fitur_kode = $2`, [faskesUuid, kodeFitur]);
    if (override) return !!override.aktif;
    if (!segmen) return true;
    return !(await satu(`SELECT 1 FROM preset_segmen_fitur_mati WHERE segmen_kode = $1 AND fitur_kode = $2`, [segmen, kodeFitur]));
  } catch (error) {
    console.warn(`[sarpras] Gagal membaca status fitur ${kodeFitur}:`, error.message);
    return false;
  }
};

export const FITUR_SARPRAS = ["sarpras_aset", "sarpras_pemeliharaan", "sarpras_kalibrasi", "sarpras_utilitas", "sarpras_laporan"];

// Middleware: 403 bila fitur (dan otomatis modul induknya) belum aktif untuk faskes pengguna.
export const wajibFiturSarpras = (kode) => (req, res, next) =>
  fiturSarprasAktif(kode, req.author?.faskesUuid)
    .then((aktif) =>
      aktif ? next() : res.status(403).json({ message: kode === "sarpras_aset" ? "Modul Sarana dan Prasarana belum aktif untuk faskes ini" : `Fitur ${kode} belum aktif untuk faskes ini` }),
    )
    .catch(next);
