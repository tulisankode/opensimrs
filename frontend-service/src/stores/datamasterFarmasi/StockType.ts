import { defineStore } from "pinia";
import { apiFarmasiGet, apiFarmasiPost, apiFarmasiPut, apiFarmasiDelete } from "@/utils/apiHandler";

export const useStockTypeStore = defineStore({
  id: "jenis-stok",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10, name:String="", payload = {}) {
      return apiFarmasiGet(`/farmasi/datamaster/jenis-stok?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async postApi(payload = {}) {
      return apiFarmasiPost("/farmasi/datamaster/jenis-stok", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/datamaster/jenis-stok/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(`/farmasi/datamaster/jenis-stok/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiFarmasiGet(`/farmasi/datamaster/jenis-stok/export`, payload);
    },
    async importApi(payload: any) {
      return apiFarmasiPost("/farmasi/datamaster/jenis-stok/import", payload);
    },
    
  },
});
