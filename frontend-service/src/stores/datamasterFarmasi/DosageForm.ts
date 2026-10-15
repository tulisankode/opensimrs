import { defineStore } from "pinia";
import { apiFarmasiGet, apiFarmasiPost, apiFarmasiPut, apiFarmasiDelete } from "@/utils/apiHandler";

export const useDosageFormStore = defineStore({
  id: "bentuk-sediaan",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10, name:String="", payload = {}) {
      return apiFarmasiGet(`/farmasi/datamaster/bentuk-sediaan?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async postApi(payload = {}) {
      return apiFarmasiPost("/farmasi/datamaster/bentuk-sediaan", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/datamaster/bentuk-sediaan/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(`/farmasi/datamaster/bentuk-sediaan/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiFarmasiGet(`/farmasi/datamaster/bentuk-sediaan/export`, payload);
    },
    async importApi(payload: any) {
      return apiFarmasiPost("/farmasi/datamaster/bentuk-sediaan/import", payload);
    },
    
  },
});
