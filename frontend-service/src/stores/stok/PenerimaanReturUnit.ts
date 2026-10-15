import { apiInventoryGet } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const usePenerimaanReturUnitStore = defineStore({
  id: "penerimaanReturUnit",
  state: () => ({}),
  actions: {
    async getAll(
      lokasiStok: String = "",
      alasan: String = "",
      search: String = "",
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiInventoryGet(
        `/inventory/penerimaan/retur-unit?page=${page}&page_size=${limit}&lokasi_stok_uuid=${lokasiStok}&alasan=${alasan}&search=${search}`,
        payload
      );
    },
    async getDetailApi(uuid: string, payload = {}) {
      return apiInventoryGet(
        `/inventory/penerimaan/retur-unit/${uuid}`,
        payload
      );
    },
  },
});
