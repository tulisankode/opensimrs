import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useVoucherStore = defineStore({
  id: "voucher",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/voucher?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/voucher", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/voucher/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/voucher/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet("/datamaster/voucher/export", payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/voucher/import", payload);
    },
  },
});
