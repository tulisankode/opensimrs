const BASE_URL_API_SETTING = process.env.SETTING_SERVICE_URL || "http://localhost:8094";

// Status fitur faskes dari Setting › Manajemen Modul & Fitur. null = tidak diketahui (setting-service tidak
// terjangkau) — fail-open agar penunjang-service tidak ikut gagal saat setting-service sedang bermasalah.
export const fiturAktif = async (kode, token) => {
  try {
    const res = await fetch(`${BASE_URL_API_SETTING}/api/v3/setting/modul`, {
      signal: AbortSignal.timeout(5000),
      headers: token ? { Authorization: token } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const aktif = data?.payload?.fitur_aktif;
    return Array.isArray(aktif) ? aktif.includes(kode) : null;
  } catch (error) {
    console.warn(`[lis-pa] Gagal membaca fitur ${kode}:`, error.message);
    return null;
  }
};

// Middleware Express: tolak eksplisit bila fitur nonaktif (tidak tahu statusnya → tetap diizinkan).
export const wajibFiturPaLis = () => (req, res, next) =>
  fiturAktif("pa_bridging_lis", req.headers.authorization)
    .then((aktif) => (aktif === false ? res.status(403).json({ message: "Fitur Bridging LIS Patologi Anatomi belum diaktifkan untuk faskes ini" }) : next()))
    .catch(next);
