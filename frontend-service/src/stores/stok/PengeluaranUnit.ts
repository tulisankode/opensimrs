import { apiInventoryGet, apiStokGet, apiStokPost } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const usePengeluaranUnitStore = defineStore({
  id: "pengeluaranUnit",
  state: () => ({}),
  actions: {
    async getAll(page = 1, page_size = 10, no_pengeluaran = "", payload = {}) {
      return apiStokGet(
        `/stok/pengeluaran-unit?page=${page}&page_size=${page_size}&no_pengeluaran=${no_pengeluaran}`,
        payload
      );
    },

    async inventoryStokByLocation(lokasi_stok_uuid = "", payload = {}) {
      return apiInventoryGet(
        `/inventory/stok?lokasi_stok_uuid=${lokasi_stok_uuid}`,
        payload
      );
    },

    async getPengeluaranUnitDetail(uuid = "", payload = {}) {
      return apiStokGet(`/stok/pengeluaran-unit/${uuid}`, payload);
    },

    async postPengeluaranUnit(payload = {}) {
      return apiStokPost("/stok/pengeluaran-unit", payload);
    },
  },
});
