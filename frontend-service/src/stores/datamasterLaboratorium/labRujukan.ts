import { defineStore } from "pinia";
import {
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
} from "@/utils/apiHandler";

export const useLabRujukanStore = defineStore({
  id: "lab-rujukan",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10, name: string, payload = {}) {
      return apiLaboratoriumGet(
        `/lab/lab-rujukan?page=${page}&limit=${limit}&name=${name}`,
        payload
      );
    },
    async getActiveApi(payload = {}) {
      return apiLaboratoriumGet(`/lab/lab-rujukan/active`, payload);
    },
    async postApi(payload = {}) {
      return apiLaboratoriumPost("/lab/lab-rujukan", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/lab-rujukan/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiLaboratoriumDelete(`/lab/lab-rujukan/${uuid}`, payload);
    },
    async importApi(payload: any) {
      return apiLaboratoriumPost("/lab/lab-rujukan/import", payload);
    },
  },
});
