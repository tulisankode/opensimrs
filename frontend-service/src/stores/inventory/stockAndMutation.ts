import { apiInventoryGet, apiInventoryPost } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useStockAndMutationStore = defineStore({
  id: "StockAndMutation",
  state: () => ({}),
  getters: {},
  actions: {
    async getApiStok(
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
        `/inventory/mutasi/kartu-stok?lokasi_stok_uuid=${lokasiStok}&kategori=${kategori}&jenis_stok_uuid=${jenisStok}&jenis_item=${jenis}&search=${search}&page=${page}&limit=${limit}`,
        payload
      );
    },
    async postApiStok(payload = {}) {
      return apiInventoryPost("/inventory/mutasi/kartu-stok/cetak", payload);
    },
    async getApiMutasi(
      lokasiStok: String = "",
      jenisStok: String = "",
      kategori: string = "",
      jenis: String = "",
      search: String = "",
      startDate: number = 0,
      endDate: number = 0,
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiInventoryGet(
        `/inventory/mutasi/riwayat-mutasi?lokasi_stok_uuid=${lokasiStok}&kategori=${kategori}&jenis_stok_uuid=${jenisStok}&jenis_item=${jenis}&search=${search}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=${limit}`,
        payload
      );
    },
    async postApiMutasi(payload = {}) {
      return apiInventoryPost("/inventory/mutasi/riwayat-mutasi/cetak", payload);
    },
  },
});
