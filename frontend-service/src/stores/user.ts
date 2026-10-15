import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterDelete,
  apiDatamasterPut,
} from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useUserStore = defineStore({
  id: "user",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      params: {
        page?: number;
        limit?: number;
        name?: string;
        role?: string;
        payload?: object;
      } = {}
    ) {
      const { page = 1, limit = 10, name, role, payload = {} } = params;

      // Bangun URL secara dinamis
      let url = `/datamaster/user?page=${page}&total=${limit}&name=${name}`;
      if (role) {
        url += `&role=${role}`;
      }

      return apiDatamasterGet(url, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/user", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/user/${uuid}`, payload);
    },
    async importApi(payload = {}) {
      return apiDatamasterPost("/datamaster/user/import", payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet("/datamaster/user/-/export", payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/user/${uuid}`, payload);
    },
  },
});
