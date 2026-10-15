import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useOrganisasiStore = defineStore({
  id: "organisasi",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/organization?page=${page}&limit=${limit}&name=${name}`, payload);
    },  
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/organization", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/organization/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/organization/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/organization/export`, payload);
    },
    async importApi(payload = {}) {
      return apiDatamasterPost("/datamaster/organization/import", payload);
    },
  },
});
