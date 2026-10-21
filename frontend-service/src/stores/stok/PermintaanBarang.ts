import { apiStokGet, apiStokPost, apiStokPut } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const usePermintaanBarangStore = defineStore({
  id: "permintaanBarang",
  state: () => ({}),
  actions: {
    async getAll(
      page = 1,
      page_size = 10,
      status = "",
      no_permintaan = "",
      lokasi_stok_tujuan_uuid = "",
      payload = {}
    ) {
      return apiStokGet(
        `/stok/permintaan-unit?page=${page}&page_size=${page_size}&status=${status}&no_permintaan=${no_permintaan}&lokasi_stok_tujuan_uuid=${lokasi_stok_tujuan_uuid}`,
        payload
      );
    },

    async postPermintaanBarang(payload = {}) {
      return apiStokPost("/stok/permintaan-unit", payload);
    },
    async batalPermintaanBarang(uuid = "", payload = {}) {
      return apiStokPut(`/stok/permintaan-unit/${uuid}/status`, payload);
    },
  },
});
