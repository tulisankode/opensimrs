import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useSnomedCTStore = defineStore({
  id: "snomed",
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
        `/datamaster/snomed?page=${page}&limit=${limit}&name=${name}`,
        payload
      );
    },
    async getAktifApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/snomed/aktif`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/snomed", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/snomed/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/snomed/${uuid}`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/snomed/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/snomed/import", payload);
    },
  },
});
