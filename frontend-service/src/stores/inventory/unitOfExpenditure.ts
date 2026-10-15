import { apiInventoryGet, apiInventoryPost, apiInventoryPut, apiInventoryDelete } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useUnitOfExpenditureStore = defineStore({
  id: "UnitOfExpenditure",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(lokasiStok: String = "", search: String = "", page: number = 1, limit: number = 10, payload = {}) {
      return apiInventoryGet(`/inventory/pengeluaran/pengeluaran-unit?lokasi_stok_uuid=${lokasiStok}&search=${search}&page=${page}&limit=${limit}`, payload);
    },
    async getApiDetail(uuid: string, payload = {}) {
      return apiInventoryGet(`/inventory/pengeluaran/pengeluaran-unit/${uuid}`, payload);
    },
    async getApiAvailable(tanggalPengeluaran: number, jenisStokUuid: string, lokasiStokUuid: string, jenisItem: string, kategoriItem: String, payload = {}) {
      return apiInventoryGet(`/inventory/pengeluaran/pengeluaran-unit/available-stock?tanggal_pengeluaran=${tanggalPengeluaran}&jenis_stok_uuid=${jenisStokUuid}&lokasi_stok_uuid=${lokasiStokUuid}&jenis_item=${jenisItem}&kategori_item=${kategoriItem}`, payload);
    },
    async postApi(payload = {}) {
      return apiInventoryPost("/inventory/pengeluaran/pengeluaran-unit", payload);
    },
  },
}); 
