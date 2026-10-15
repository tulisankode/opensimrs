import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useGigiStore = defineStore({
  id: "gigi",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,display:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/gigi?page=${page}&limit=${limit}&display=${display}`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/gigi", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/gigi/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/gigi/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/gigi/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/gigi/import", payload);
    },
  },
});
