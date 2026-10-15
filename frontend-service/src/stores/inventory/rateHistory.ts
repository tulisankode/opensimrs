import { apiInventoryGet } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useRateHistoryStore = defineStore({
  id: "RateHistory",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      lokasiStok: String = "",
      jenisStok: String = "",
      kategori: string = "",
      jenis: String = "",
      search: String = "",
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiInventoryGet(
        `/inventory/riwayat-tarif?lokasi_stok_uuid=${lokasiStok}&kategori=${kategori}&jenis_stok_uuid=${jenisStok}&jenis_item=${jenis}&search=${search}&page=${page}&limit=${limit}`, payload);
    },
    async getApiDetail(uuid: string, payload = {}) {
      return apiInventoryGet(`/inventory/riwayat-tarif/${uuid}`, payload);
    },
  },
});
