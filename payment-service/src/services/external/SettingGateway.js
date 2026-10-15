import axios from 'axios';
import { EXTERNAL_API_CONFIG } from '../../configs/external-api.js';
import { Context } from '../../middlewares/context.js';
import { CTX_TOKEN } from '../../constants/context-constant.js';

export default class SettingGateway {
  // Status fitur faskes dari Setting › Manajemen Modul & Fitur. null = tidak diketahui (setting tidak terjangkau).
  static async fiturAktif(kode) {
    const { BASE_URL, TIMEOUT } = EXTERNAL_API_CONFIG.SETTING_SERVICE;
    try {
      const res = await axios.get(`${BASE_URL}/api/v3/setting/modul`, { timeout: TIMEOUT, headers: { Authorization: Context.get(CTX_TOKEN) } });
      const aktif = res.data?.payload?.fitur_aktif;
      return Array.isArray(aktif) ? aktif.includes(kode) : null;
    } catch (error) {
      console.warn(`[SettingGateway] Gagal membaca fitur ${kode}:`, error.message);
      return null;
    }
  }

  static async getFaskesFinanceConfig(faskesUuid) {
    const { BASE_URL, TIMEOUT } = EXTERNAL_API_CONFIG.SETTING_SERVICE;
    const token = Context.get(CTX_TOKEN);
    const headers = { Authorization: token };
    try {
      const [ppnRes, adminRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/v3/setting/ppn`, { timeout: TIMEOUT, headers }),
        axios.get(`${BASE_URL}/api/v3/setting/biaya-administrasi`, { timeout: TIMEOUT, headers }),
      ]);
      const ppnPayload = ppnRes.data?.payload || {};
      const ppnPercent = ppnPayload.status_ppn ? parseFloat(ppnPayload.value_ppn) : 0;

      const adminPayload = adminRes.data?.payload || {};
      const adminFee = adminPayload.status_biaya_lain ? parseFloat(adminPayload.value_biaya_lain) : 0;

      console.log(`[SettingGateway] Finance Config Fetched: PPN=${ppnPercent}%, Admin=${adminFee}`);

      return {
        ppn_percent: ppnPercent,
        admin_fee: adminFee,
      };
    } catch (error) {
      console.warn(`[SettingGateway] Gagal mengambil config finance untuk ${faskesUuid}:`, error.message);
      return {
        ppn_percent: 0,
        admin_fee: 0,
      };
    }
  }
}
