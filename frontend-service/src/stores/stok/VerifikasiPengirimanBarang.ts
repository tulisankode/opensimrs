import { apiStokGet, apiStokPut } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useVerifikasiPengirimanBarangStore = defineStore({
  id: "verifikasiPengirimanBarang",
  state: () => ({}),
  actions: {
    async getAll(
      page = 1,
      page_size = 10,
      status = "",
      no_permintaan = "",
      nama_lokasi_tujuan = "",
      payload = {}
    ) {
      return apiStokGet(
        `/stok/permintaan-unit?page=${page}&page_size=${page_size}&status=${status}&no_permintaan=${no_permintaan}&nama_lokasi_tujuan=${nama_lokasi_tujuan}`,
        payload
      );
    },

    async verifChangeStatus(uuid = "", payload = {}) {
      return apiStokPut(`/stok/permintaan-unit/${uuid}/status`, payload);
    },

    async batalVerif(uuid = "", payload = {}) {
      return apiStokPut(`/stok/permintaan-unit/${uuid}/status`, payload);
    },
  },
});
