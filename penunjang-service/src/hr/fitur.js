import { fiturSarprasAktif } from "../sarpras/fitur.js";

// Status fitur katalog (Manajemen Modul) modul HR / SDM untuk faskes pengguna; pembacanya dipakai ulang dari
// sarpras/fitur.js (aturan sama dengan setting-service, fail-closed). Setiap fitur SDM yang punya rute didaftarkan di sini.
export const FITUR_SDM = ["sdm_kepegawaian", "sdm_kredensial", "sdm_kehadiran", "sdm_pelatihan", "sdm_jadwal_dinas", "sdm_penggajian"];
export const fiturSdmAktif = (kode, faskesUuid) => fiturSarprasAktif(kode, faskesUuid);

// Middleware: 403 bila fitur (dan otomatis modul induk "sdm") belum aktif untuk faskes pengguna.
export const wajibFiturSdm = (kode) => (req, res, next) =>
  fiturSdmAktif(kode, req.author?.faskesUuid)
    .then((aktif) => (aktif ? next() : res.status(403).json({ message: `Fitur ${kode} (HR / SDM) belum aktif untuk faskes ini` })))
    .catch(next);
