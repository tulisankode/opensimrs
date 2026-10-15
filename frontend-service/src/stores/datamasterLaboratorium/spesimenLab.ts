import { defineStore } from "pinia";
import {
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
} from "@/utils/apiHandler";

export const useSpesimenLabStore = defineStore({
  id: "spesimen-lab",
  state: () => ({}),
  getters: {},
  actions: {
    // async getApi(
    //   params: {
    //     page?: number;
    //     limit?: number;
    //     name?: string;
    //     payload?: object;
    //   } = {}
    // ) {
    //   const { page = 1, limit = 10, name = "", payload = {} } = params;
    //   return apiLaboratoriumGet(
    //     `/lab/spesimen?page=${page}&limit=${limit}&name=${name}`,
    //     payload
    //   );
    // },

     async getApi(page: number = 1, limit: number = 10, name: string , payload = {}) {
          return apiLaboratoriumGet(
            `/lab/spesimen?page=${page}&limit=${limit}&name=${name}`,
            payload
          );
        },
    async postApi(payload = {}) {
      return apiLaboratoriumPost("/lab/spesimen", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/spesimen/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiLaboratoriumDelete(`/lab/spesimen/${uuid}`, payload);
    },
    async exportApi(payload = {}) {
      return apiLaboratoriumGet(`/lab/spesimen/export`, payload);
    },
    async importApi(payload: any) {
      return apiLaboratoriumPost("/lab/spesimen/import", payload);
    },
  },
});
