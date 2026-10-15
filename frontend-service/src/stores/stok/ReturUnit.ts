import { defineStore } from "pinia";

import { apiInventoryGet, apiStokGet, apiStokPost } from "@/utils/apiHandler";

export const useReturUnitStore = defineStore({
  id: "returUnit",
  state: () => ({}),
  actions: {
    async getAll(
      page = 1,
      page_size = 10,
      no_retur = "",
      tujuan_retur = "",
      alasan_retur = "",
      payload = {}
    ) {
      return apiStokGet(
        `/stok/retur-unit?page=${page}&page_size=${page_size}&no_retur=${no_retur}&tujuan_retur=${tujuan_retur}&alasan_retur=${alasan_retur}`,
        payload
      );
    },

    async inventoryStokByLocation(lokasi_stok_uuid = "", payload = {}) {
      return apiInventoryGet(
        `/inventory/stok?lokasi_stok_uuid=${lokasi_stok_uuid}`,
        payload
      );
    },

    async postReturUnit(payload = {}) {
      return apiStokPost(`/stok/retur-unit`, payload);
    },
  },
});
