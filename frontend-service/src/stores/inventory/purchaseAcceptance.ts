import { apiInventoryGet, apiInventoryPut } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const usePurchaseAcceptanceStore = defineStore({
  id: "purchaseAcceptance",
  state: () => ({}),
  getters: {},
  actions: {
    // async getApi( filter: String = "", name: String = "", page: number = 1, limit: number = 10, payload = {} ) {
    //   return apiInventoryGet(`/inventory/penerimaan-retur-unit?lokasi_stok_tujuan_uuid=${filter}&alasan=${name}&page=${page}&limit=${limit}`, payload);
    // },
    async getApi(
      lokasiStok: String= "",
      filter: String = "",
      name: String = "",
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiInventoryGet(
        `/inventory/pengadaan/pembelian-barang?lokasi_stok_uuid=${lokasiStok}&filter=${filter}&search=${name}&page=${page}&limit=${limit}`,
        payload
      );
    },
    async getApiDetail(uuid: string, payload = {}) {
      return apiInventoryGet(`/inventory/pengadaan/pembelian-barang/${uuid}`, payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiInventoryPut(`/inventory/penerimaan/pembelian/${uuid}`, payload);
    },
  },
});
  