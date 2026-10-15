import { apiInventoryGet, apiInventoryPost ,apiInventoryPut} from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useStokAdjustmentStore = defineStore({
  id: "StokAdjustment",
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
        `/inventory/stok-adjustment?lokasi_stok_uuid=${lokasiStok}&kategori=${kategori}&jenis_stok_uuid=${jenisStok}&jenis_item=${jenis}&search=${search}&page=${page}&limit=${limit}`,
        payload
      );
    },
    async getDetailApi(lokasiStok: String = "", uuid: String = "", payload = {}
    ) {
      return apiInventoryGet(`/inventory/stok-adjustment/${uuid}?lokasi_stok_uuid=${lokasiStok}`, payload);
    },
    async putApi(payload = {}) {
      return apiInventoryPut(`/inventory/stok-adjustment`, payload);
    },
  },
});
