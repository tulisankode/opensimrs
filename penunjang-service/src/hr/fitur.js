import { fiturSarprasAktif } from "../sarpras/fitur.js";

export const FITUR_SDM = ["sdm_kepegawaian", "sdm_kredensial"];
export const fiturSdmAktif = (kode, faskesUuid) => fiturSarprasAktif(kode, faskesUuid);
export const wajibFiturSdm = (kode) => (req, res, next) =>
  fiturSdmAktif(kode, req.author?.faskesUuid)
    .then((aktif) => (aktif ? next() : res.status(403).json({ message: `Fitur ${kode} (HR / SDM) belum aktif untuk faskes ini` })))
    .catch(next);
