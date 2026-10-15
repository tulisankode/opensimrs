import { defineStore } from "pinia";
import {
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
} from "@/utils/apiHandler";

export const useItemPemeriksaanStore = defineStore({
  id: "item-pemeriksaan",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      params: {
        page?: number;
        limit?: number;
        name?: string;
        payload?: object;
      } = {}
    ) {
      const { page = 1, limit = 10, name = "", payload = {} } = params;
      return apiLaboratoriumGet(
        `/lab/item-pemeriksaan?page=${page}&limit=${limit}&name=${name}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiLaboratoriumPost("/lab/item-pemeriksaan", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/item-pemeriksaan/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiLaboratoriumDelete(`/lab/item-pemeriksaan/${uuid}`, payload);
    },

    // Nilai Rujukan
    async getNilaiRujukanApi(uuid: string, payload = {}) {
      return apiLaboratoriumGet(`/lab/nilai-rujukan/${uuid}`, payload);
    },
    async postNilaiRujukanApi(payload = {}) {
      return apiLaboratoriumPost(`/lab/nilai-rujukan`, payload);
    },
    async putNilaiRujukanApi(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/nilai-rujukan/${uuid}`, payload);
    },
    async deleteNilaiRujukanApi(uuid: string, payload = {}) {
      return apiLaboratoriumDelete(`/lab/nilai-rujukan/${uuid}`, payload);
    },

    // eksport dan import
    async importApi(payload: any) {
      return apiLaboratoriumPost("/lab/item-pemeriksaan/import", payload);
    },
    async getActive(payload = {}) {
      return apiLaboratoriumGet(`/lab/item-pemeriksaan/active`, payload);
    },
  },
});
