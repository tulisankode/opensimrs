import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const usePegawaiStore = defineStore({
  id: "pegawai",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      params: {
        page?: number;
        limit?: number;
        name?: string;
        type?: string;
        payload?: object;
      } = {}
    ) {
      const {
        page = 1,
        limit = 10,
        name = "",
        type = "",
        payload = {},
      } = params;
      return apiDatamasterGet(
        `/datamaster/pegawai?page=${page}&limit=${limit}&name=${name}&type=${type}`,
        payload
      );
    },
    async getAktifApi(type = "", payload = {}) {
      return apiDatamasterGet(`/datamaster/pegawai/aktif?type=${type}`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/pegawai", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/pegawai/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/pegawai/${uuid}`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/pegawai/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/pegawai/import", payload);
    },
  },
});
