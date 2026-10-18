import config from "../../config.js";
import { fiturAktifFaskes } from "../../bank-darah/utd/izin.js";

// Status fitur hd_bridging_hdis (Setting › Manajemen Modul & Fitur). Fail-closed (sama dengan pacs/izin.js &
// bank-darah/utd/izin.js): bridging ini memuat data pasien & parameter klinis, sehingga status yang tidak dapat
// diverifikasi dianggap nonaktif.
export const KODE_FITUR_HDIS = "hd_bridging_hdis";

export const fiturHdisAktif = async (token) => {
  try {
    const res = await fetch(`${config.settingUrl}/modul`, { signal: AbortSignal.timeout(5000), headers: token ? { Authorization: token } : {} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const aktif = (await res.json())?.payload?.fitur_aktif;
    return Array.isArray(aktif) && aktif.includes(KODE_FITUR_HDIS);
  } catch (error) {
    console.warn("[hd-hdis] Gagal membaca status fitur hd_bridging_hdis:", error.message);
    return false;
  }
};

// Middleware rute konfigurasi/riwayat HDIS terautentikasi.
export const wajibFiturHdisAktif = async (req, res, next) => {
  if (!(await fiturHdisAktif(req.author?.token))) {
    return res.status(403).json({ message: "Fitur Bridging HDIS belum diaktifkan untuk faskes ini (Setting › Manajemen Modul)" });
  }
  next();
};

// Varian per faskes tanpa token (titik masuk push HDIS & pengiriman jadwal otomatis): membaca katalog & override
// Manajemen Modul langsung dari database dengan aturan yang sama dengan setting-service (lihat bank-darah/utd/izin.js).
export const fiturHdisAktifFaskes = (faskesUuid) => fiturAktifFaskes(faskesUuid, KODE_FITUR_HDIS);
