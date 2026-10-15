import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const usePenjaminStore = defineStore({
  id: "penjamin",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/penjamin?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async getAktifApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/penjamin/aktif`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/penjamin", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/penjamin/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/penjamin/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/penjamin/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/penjamin/import", payload);
    },
  },
});
