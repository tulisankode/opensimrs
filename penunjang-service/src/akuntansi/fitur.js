import { fiturSarprasAktif } from "../sarpras/fitur.js";

// Status fitur katalog (Manajemen Modul) modul Akuntansi & Remunerasi untuk faskes pengguna; pembacanya dipakai ulang dari
// sarpras/fitur.js (aturan sama dengan setting-service, fail-closed). akuntansi_remunerasi = jasa pelayanan (STD-0032).
export const FITUR_AKUNTANSI = ["akuntansi_jurnal", "akuntansi_laporan", "akuntansi_remunerasi"];
export const fiturAkuntansiAktif = (kode, faskesUuid) => fiturSarprasAktif(kode, faskesUuid);

// Middleware: 403 bila fitur (dan otomatis modul induk "akuntansi") belum aktif untuk faskes pengguna.
export const wajibFiturAkuntansi = (kode) => (req, res, next) =>
  fiturAkuntansiAktif(kode, req.author?.faskesUuid)
    .then((aktif) => (aktif ? next() : res.status(403).json({ message: `Fitur ${kode} (Akuntansi & Remunerasi) belum aktif untuk faskes ini` })))
    .catch(next);
