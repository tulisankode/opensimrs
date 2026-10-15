import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useTindakanStore = defineStore({
  id: "tindakan",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/tindakan?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async getAktifApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/tindakan/aktif`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/tindakan", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/tindakan/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/tindakan/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/tindakan/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/tindakan/import", payload);
    },
  },
});
