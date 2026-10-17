import config from "../../config.js";

// Status fitur bdrs_bridging dari Setting › Manajemen Modul & Fitur. null = tidak diketahui (setting-service tidak
// terjangkau) — fail-closed (sama dengan pacs/izin.js) karena bridging ini berisiko tinggi terhadap keselamatan
// transfusi (golongan darah & IMLTD) — lihat Rancangan Teknis STD-0017 §10.
export const fiturBdrsBridgingAktif = async (token) => {
  try {
    const res = await fetch(`${config.settingUrl}/modul`, {
      signal: AbortSignal.timeout(5000),
      headers: token ? { Authorization: token } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const aktif = data?.payload?.fitur_aktif;
    return Array.isArray(aktif) && aktif.includes("bdrs_bridging");
  } catch (error) {
    console.warn("[bdrs-utd] Gagal membaca status fitur bdrs_bridging:", error.message);
    return false;
  }
};

// Middleware: tolak seluruh rute bridging UTD terautentikasi bila fitur nonaktif untuk faskes pengguna.
export const wajibFiturBdrsBridgingAktif = async (req, res, next) => {
  if (!(await fiturBdrsBridgingAktif(req.author?.token))) {
    return res.status(403).json({ message: "Fitur Bridging Bank Darah (UTD) belum diaktifkan untuk faskes ini (Setting › Manajemen Modul)" });
  }
  next();
};
