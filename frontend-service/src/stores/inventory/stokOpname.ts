import { apiInventoryGet, apiInventoryPost, apiInventoryPut } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useStokOpnameStore = defineStore({
  id: "StokOpname",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      lokasiStok: String = "",
      search: String = "",
      page: Number = 1,
      limit: Number = 10,
      payload = {}
    ) {
      return apiInventoryGet(`/inventory/stok-opname?lokasi_stok_uuid=${lokasiStok}&search=${search}&page=${page}&limit=${limit}`, payload);
    },

    async getApiDetail(
      uuid: String = "",
      search: String = "",
      jenisItem: String = "",
      page: Number = 1,
      limit: Number = 10,
      payload = {}
    ) {
      return apiInventoryGet(`/inventory/stok-opname/${uuid}?search=${search}&jenis_item=${jenisItem}&page=${page}&limit=${limit}`, payload);
    },

    async getApiRekonsil(
      lokasiStok: String = "",
      jenisStok: String = "",
      jenisItem: String = "",
      kategoriItem: String = "",
      type: String = "",
      page: Number = 1,
      limit: Number = 10,
      payload = {}
    ) {
      return apiInventoryGet(`/inventory/stok-opname/kartu-stok?lokasi_stok_uuid=${lokasiStok}&jenis_stok_uuids=${jenisStok}&jenis_items=${jenisItem}&kategori_item=${kategoriItem}&type=${type}&page=${page}&limit=${limit}`, payload);
    },

    async postApi(payload = {}) {
      return apiInventoryPost("/inventory/stok-opname", payload);
    },
    
    async putApi(uuid: string, payload = {}) {
      return apiInventoryPut(`/inventory/stok-opname/${uuid}`, payload);
    },

    async importApi(payload = {}) {
      return apiInventoryPost(`/inventory/stok-opname/import`, payload);
    },
  },
});
