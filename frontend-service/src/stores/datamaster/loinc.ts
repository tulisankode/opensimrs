import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useLoincStore = defineStore({
    id: "loinc",
    state: () => ({}),
    getters: {},
    actions: {
      async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
        return apiDatamasterGet(`/datamaster/loinc?page=${page}&limit=${limit}&name=${name}`, payload);
      },
      async postApi(payload = {}) {
        return apiDatamasterPost("/datamaster/loinc", payload);
      },
      async putApi(uuid: string, payload = {}) {
        return apiDatamasterPut(`/datamaster/loinc/${uuid}`, payload);
      },
      async deleteApi(uuid: string, payload = {}) {
        return apiDatamasterDelete(`/datamaster/loinc/${uuid}`, payload);
      },
      async exportApi(payload = {}) {      
        return apiDatamasterGet(`/datamaster/loinc/export`, payload);
      },
      async importApi(payload: any) {
        return apiDatamasterPost("/datamaster/loinc/import", payload);
      },
    },
  });