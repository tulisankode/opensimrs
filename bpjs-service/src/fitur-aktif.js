const BASE_URL_API_SETTING = process.env.SETTING_SERVICE_URL || "http://localhost:8094";

// Status fitur faskes dari Setting › Manajemen Modul & Fitur: true | false, atau null = tidak diketahui
// (setting-service tidak terjangkau / respons tidak dikenal). Pemanggil WAJIB memperlakukan null sebagai
// tidak aktif (fail-closed): fitur yang mengirim data ke BPJS tidak boleh lolos hanya karena setting-service
// sedang bermasalah. Memakai fetch bawaan Node (bpjs-service tidak punya dependensi axios).
const fiturAktif = async (kode, token) => {
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
    console.warn(`[fiturAktif] Gagal membaca fitur ${kode}:`, error.message);
    return null;
  }
};

// Pesan penolakan untuk hasil fiturAktif selain true.
export const pesanFiturNonaktif = (aktif, nama) =>
  aktif === false
    ? `Fitur ${nama} belum diaktifkan untuk faskes ini`
    : `Status fitur ${nama} tidak dapat diperiksa (setting-service tidak terjangkau); permintaan ditolak demi keamanan`;

export default fiturAktif;
