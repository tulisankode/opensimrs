import { defineStore } from "pinia";
import {
  apiFarmasiGet,
  apiFarmasiPost,
  apiFarmasiPut,
  apiFarmasiDelete,
  apiInventoryGet,
} from "@/utils/apiHandler";

export const useStockLocationStore = defineStore({
  id: "lokasi-stok",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      limit: number = 10,
      name: String = "",
      jenisLokasi: String = "",
      kodeTujuan = "",
      payload = {}
    ) {
      return apiFarmasiGet(
        `/farmasi/datamaster/lokasi-stok?page=${page}&limit=${limit}&name=${name}&jenis_lokasi=${jenisLokasi}&kode_tujuan=${kodeTujuan}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiFarmasiPost("/farmasi/datamaster/lokasi-stok", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/datamaster/lokasi-stok/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(
        `/farmasi/datamaster/lokasi-stok/${uuid}`,
        payload
      );
    },
    async exportApi(payload = {}) {
      return apiFarmasiGet(`/farmasi/datamaster/lokasi-stok/export`, payload);
    },
    async importApi(payload: any) {
      return apiFarmasiPost("/farmasi/datamaster/lokasi-stok/import", payload);
    },
    async getInventoryStok(lokasi_stok_uuid = "", payload = {}) {
      return apiInventoryGet(
        `/inventory/stok?lokasi_stok_uuid=${lokasi_stok_uuid}`,
        payload
      );
    },
  },
});
