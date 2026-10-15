import { defineStore } from "pinia";
import { apiFarmasiGet, apiFarmasiPost, apiFarmasiPut, apiFarmasiDelete } from "@/utils/apiHandler";

export const useDrugCategoryStore = defineStore({
  id: "kategori-obat",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10, name:String="", payload = {}) {
      return apiFarmasiGet(`/farmasi/datamaster/kategori-obat?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async postApi(payload = {}) {
      return apiFarmasiPost("/farmasi/datamaster/kategori-obat", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/datamaster/kategori-obat/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(`/farmasi/datamaster/kategori-obat/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiFarmasiGet(`/farmasi/datamaster/kategori-obat/export`, payload);
    },
    async importApi(payload: any) {
      return apiFarmasiPost("/farmasi/datamaster/kategori-obat/import", payload);
    },
    
  },
});
