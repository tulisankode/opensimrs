import {
  apiInventoryGet,
  apiInventoryPost,
  apiInventoryPut,
  apiInventoryDelete,
} from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useUnitDeliveryVerificationStore = defineStore({
  id: "UnitDeliveryVerification",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      lokasiStok: String = "",
      status: string | string[] = "",
      name: String = "",
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      let apiUrl = `/inventory/pengeluaran/pengiriman-unit?lokasi_gudang_uuid=${lokasiStok}`;
      if (Array.isArray(status)) {
        status.forEach(s => {
          apiUrl += `&status=${s}`;
        });
      } else if (status) {
        apiUrl += `&status=${status}`;
      }
      apiUrl += `&search=${name}&page=${page}&limit=${limit}`;

      return apiInventoryGet(apiUrl, payload);
    },
    async getApiDetail(uuid: string, payload = {}) {
      return apiInventoryGet(`/inventory/pengeluaran/pengiriman-unit/${uuid}`, payload);
    },
    async putVerifyApi(uuid: string, payload = {}) {
      return apiInventoryPut(
        `/inventory/pengeluaran/pengiriman-unit/verifikasi/${uuid}`,
        payload
      );
    },
    async putSendApi(uuid: string, payload = {}) {
      return apiInventoryPut(
        `/inventory/pengeluaran/pengiriman-unit/kirim/${uuid}`,
        payload
      );
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiInventoryPut(`/inventory/pengeluaran/pengiriman-unit/batal/${uuid}`, payload);
    },
  },
});
