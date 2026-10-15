import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useFaskesStore = defineStore({
    id: "faskes",
    state: () => ({}),
    getters: {},
    actions: {
      async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
        return apiDatamasterGet(`/datamaster/faskes?page=${page}&limit=${limit}&name=${name}`, payload);
      },
      async getAktifApi(payload = {}) {      
        return apiDatamasterGet(`/datamaster/faskes/aktif`, payload);
      },
      async postApi(payload = {}) {
        return apiDatamasterPost("/datamaster/faskes", payload);
      },
      async putApi(uuid: string, payload = {}) {
        return apiDatamasterPut(`/datamaster/faskes/${uuid}`, payload);
      },
      async deleteApi(uuid: string, payload = {}) {
        return apiDatamasterDelete(`/datamaster/faskes/${uuid}`, payload);
      },
      async exportApi(payload = {}) {      
        return apiDatamasterGet(`/datamaster/faskes/export`, payload);
      },
      async importApi(payload: any) {
        return apiDatamasterPost("/datamaster/faskes/import", payload);
      },
    },
  });