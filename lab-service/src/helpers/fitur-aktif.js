import axios from "axios";

const BASE_URL_API_SETTING = process.env.SETTING_SERVICE_URL || "http://localhost:8094";

// Status fitur faskes dari Setting › Manajemen Modul & Fitur. null = tidak diketahui
// (setting-service tidak terjangkau) — dipakai sebagai fail-open agar lab-service
// tidak ikut gagal saat setting-service sedang bermasalah.
const fiturAktif = async (kode, token) => {
  try {
    const res = await axios.get(`${BASE_URL_API_SETTING}/api/v3/setting/modul`, {
      timeout: 5000,
      headers: token ? { Authorization: token } : {},
    });
    const aktif = res.data?.payload?.fitur_aktif;
    return Array.isArray(aktif) ? aktif.includes(kode) : null;
  } catch (error) {
    console.warn(`[fiturAktif] Gagal membaca fitur ${kode}:`, error.message);
    return null;
  }
};

export default fiturAktif;
