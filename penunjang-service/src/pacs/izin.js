import config from "../config.js";

// Status fitur rad_bridging_pacs dari Setting › Manajemen Modul & Fitur. null = tidak diketahui (setting-service
// tidak terjangkau) — fail-closed untuk PACS (berbeda dari lab-service/src/helpers/fitur-aktif.js yang fail-open)
// karena integrasi ini berisiko tinggi (lihat Rancangan Teknis STD-0012 §2).
export const fiturPacsAktif = async (token) => {
  try {
    const res = await fetch(`${config.settingUrl}/modul`, {
      signal: AbortSignal.timeout(5000),
      headers: token ? { Authorization: token } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const aktif = data?.payload?.fitur_aktif;
    return Array.isArray(aktif) && aktif.includes("rad_bridging_pacs");
  } catch (error) {
    console.warn("[pacs] Gagal membaca status fitur rad_bridging_pacs:", error.message);
    return false;
  }
};

// Middleware: tolak seluruh rute PACS terautentikasi bila fitur nonaktif untuk faskes pengguna.
export const wajibFiturPacsAktif = async (req, res, next) => {
  if (!(await fiturPacsAktif(req.author?.token))) {
    return res.status(403).json({ message: "Fitur Bridging PACS/RIS belum diaktifkan untuk faskes ini (Setting › Manajemen Modul)" });
  }
  next();
};
