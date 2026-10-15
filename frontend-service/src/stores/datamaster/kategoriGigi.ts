import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useKategoriGigiStore = defineStore({
  id: "kategoriGigi",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,display:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/kategori_gigi?page=${page}&limit=${limit}&display=${display}`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/kategori_gigi", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/kategori_gigi/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/kategori_gigi/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/kategori_gigi/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/kategori_gigi/import", payload);
    },
  },
});
