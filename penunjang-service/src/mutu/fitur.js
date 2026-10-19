import { fiturSarprasAktif } from "../sarpras/fitur.js";

// Status fitur katalog (Manajemen Modul) modul Mutu & Akreditasi untuk faskes pengguna. Aturannya sama dengan
// setting-service (fitur aktif = tersedia ∧ modul induk aktif ∧ (wajib ∨ override ∨ tidak dimatikan preset)); fungsi
// pembacanya dipakai ulang dari sarpras/fitur.js (generik, fail-closed: galat database → nonaktif).
export const FITUR_MUTU = ["mutu_dokumen_kredensial", "mutu_indikator", "mutu_ikp"];

export const fiturMutuAktif = (kode, faskesUuid) => fiturSarprasAktif(kode, faskesUuid);

// Middleware: 403 bila fitur (dan otomatis modul induk "mutu") belum aktif untuk faskes pengguna (KT-13).
export const wajibFiturMutu = (kode) => (req, res, next) =>
  fiturMutuAktif(kode, req.author?.faskesUuid)
    .then((aktif) => (aktif ? next() : res.status(403).json({ message: `Fitur ${kode} (Mutu & Akreditasi) belum aktif untuk faskes ini` })))
    .catch(next);
