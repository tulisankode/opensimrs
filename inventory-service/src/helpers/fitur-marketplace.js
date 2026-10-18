import "dotenv/config";

const BASE_URL_API_SETTING = process.env.SETTING_SERVICE_URL || "http://localhost:8094";

// Status fitur inv_marketplace dari Setting › Manajemen Modul & Fitur, pola sama dengan
// penunjang-service/src/pacs/izin.js: fail-closed (setting-service tidak terjangkau = dianggap nonaktif) karena
// fitur ini memicu pembelian/pembayaran ke pihak luar. Memakai fetch bawaan Node.
export const fiturMarketplaceAktif = async (token) => {
  try {
    const res = await fetch(`${BASE_URL_API_SETTING}/api/v3/setting/modul`, {
      signal: AbortSignal.timeout(5000),
      headers: token ? { Authorization: token } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const aktif = data?.payload?.fitur_aktif;
    return Array.isArray(aktif) && aktif.includes("inv_marketplace");
  } catch (error) {
    console.warn("[marketplace] Gagal membaca status fitur inv_marketplace:", error.message);
    return false;
  }
};

// Middleware: tolak seluruh rute marketplace terautentikasi bila fitur nonaktif untuk faskes pengguna.
export const wajibFiturMarketplaceAktif = async (req, res, next) => {
  try {
    if (!(await fiturMarketplaceAktif(req.get("Authorization")))) {
      return res.status(403).json({
        message: "Fitur Pembelian via Marketplace belum diaktifkan untuk faskes ini (Setting › Manajemen Modul)",
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
