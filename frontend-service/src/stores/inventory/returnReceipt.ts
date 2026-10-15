import { apiInventoryGet } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useReturnReceipteStore = defineStore({
  id: "returnReceipt",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi( lokasiStok: String= "", alasan: String = "", search: String = "", page: number = 1, limit: number = 10, payload = {} ) {
      return apiInventoryGet(`/inventory/penerimaan/retur-unit?lokasi_stok_uuid=${lokasiStok}&alasan_retur=${alasan}&search=${search}&page=${page}&limit=${limit}`, payload);
    },
    async getDetailApi(uuid: string, payload = {}) {
      return apiInventoryGet(`/inventory/penerimaan/retur-unit/${uuid}`, payload);
    },
  },
});
