import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useRuanganStore = defineStore({
  id: "ruangan",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      params: {
        page?: number;
        limit?: number;
        name?: string;
        kategori_ruangan_uuid?: string;
        kelas_ruangan?: string;
        payload?: object;
      } = {}
    ) {
      const {
        page = 1,
        limit = 10,
        name = "",
        kategori_ruangan_uuid = "",
        kelas_ruangan = "",
        payload = {},
      } = params;
      return apiDatamasterGet(
        `/datamaster/ruangan?page=${page}&limit=${limit}&name=${name}&kategori_ruangan_uuid=${kategori_ruangan_uuid}&kelas_ruangan=${kelas_ruangan}`,
        payload
      );
    },
    async getAktifApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/ruangan/aktif`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/ruangan", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/ruangan/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/ruangan/${uuid}`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/ruangan/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/ruangan/import", payload);
    },
  },
});
