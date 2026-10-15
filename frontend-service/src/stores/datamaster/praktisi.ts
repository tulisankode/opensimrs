import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const usePraktisiStore = defineStore({
  id: "praktisi",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      params: {
        page?: number;
        limit?: number;
        name?: string;
        isDoctor?: boolean | string;
        payload?: object;
      } = {}
    ) {
      const {
        page = 1,
        limit = 10,
        name = "",
        isDoctor = '',
        payload = {},
      } = params;
      return apiDatamasterGet(
        `/datamaster/practitioner?page=${page}&limit=${limit}&name=${name}&is_doctor=${isDoctor}`,
        payload
      );
    },
    async getAktifApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/practitioner/aktif`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/practitioner", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/practitioner/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/practitioner/${uuid}`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/practitioner/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/practitioner/import", payload);
    },
    async getPractitionerApi(payload = {}) {
      return apiDatamasterGet("/datamaster/practitioner/poli/aktif",payload);
    }
  },
});
