import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useOklusiGigiStore = defineStore({
  id: "oklusiGigi",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,display:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/oklusi_gigi?page=${page}&limit=${limit}&display=${display}`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/oklusi_gigi", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/oklusi_gigi/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/oklusi_gigi/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/oklusi_gigi/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/oklusi_gigi/import", payload);
    },
  },
});
