import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useTarifStore = defineStore({
  id: "tarif",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      limit: number = 10,
      name: String = "",
      jenis: String = "",
      unit: String = "",
      penjamin: String = "",
      payload = {}
    ) {
      return apiDatamasterGet(
        `/datamaster/tarif?page=${page}&limit=${limit}&jenis_tarif=${jenis}&name=${name}&unit_pelayanan=${unit}&penjamin=${penjamin}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/tarif", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/tarif/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/tarif/${uuid}`, payload);
    },
    async importApi(payload = {}) {
      return apiDatamasterPost(`/datamaster/tarif/import`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/tarif/export`, payload);
    },
  },
});
