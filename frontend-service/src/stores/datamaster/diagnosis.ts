import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useDiagnosisStore = defineStore({
  id: "diagnosis",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      limit: number = 10,
      name: String = "",
      payload = {}
    ) {
      return apiDatamasterGet(
        `/datamaster/diagnosis?page=${page}&limit=${limit}&name=${name}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/diagnosis", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/diagnosis/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/diagnosis/${uuid}`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/diagnosis/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/diagnosis/import", payload);
    },
  },
});
