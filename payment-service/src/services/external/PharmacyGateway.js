import axios from 'axios';
import { EXTERNAL_API_CONFIG } from '../../configs/external-api.js';

export default class PharmacyGateway {
  static async getOtcTransactionDetail(transactionCode) {
    const { BASE_URL, TIMEOUT } = EXTERNAL_API_CONFIG.PHARMACY_SERVICE;
    try {
      const response = await axios.get(`${BASE_URL}/api/v1/internal/otc/${transactionCode}`, {
        timeout: TIMEOUT,
      });
      return response.data.data;
    } catch (error) {
      console.error(`[PharmacyGateway] Gagal mengambil OTC ${transactionCode}:`, error.message);
      return null;
    }
  }
}
