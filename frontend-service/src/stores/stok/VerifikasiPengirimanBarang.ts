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
      lokasi_stok_awal_uuid = "",
      payload = {}
    ) {
      // Depo yang dipilih bertindak sebagai pemasok: tampilkan permintaan yang ditujukan kepadanya
      // (lokasi asal), bukan permintaan yang dibuat depo itu sendiri.
      return apiStokGet(
        `/stok/permintaan-unit?page=${page}&page_size=${page_size}&status=${status}&no_permintaan=${no_permintaan}&lokasi_stok_awal_uuid=${lokasi_stok_awal_uuid}`,
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
