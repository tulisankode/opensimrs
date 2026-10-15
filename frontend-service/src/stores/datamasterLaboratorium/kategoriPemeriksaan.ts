import { defineStore } from "pinia";
import {
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
} from "@/utils/apiHandler";

export const useKategoriPemeriksaanStore = defineStore({
  id: "kategori-pemeriksaan",
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
        `/lab/category-pemeriksaan?page=${page}&limit=${limit}&name=${name}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiLaboratoriumPost("/lab/category-pemeriksaan", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/category-pemeriksaan/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiLaboratoriumDelete(
        `/lab/category-pemeriksaan/${uuid}`,
        payload
      );
    },
    async importApi(payload: any) {
      return apiLaboratoriumPost("/lab/category-pemeriksaan/import", payload);
    },
    async getActive(payload = {}) {
      return apiLaboratoriumGet(`/lab/category-pemeriksaan/active`, payload);
    },
  },
});
