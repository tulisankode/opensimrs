import { defineStore } from "pinia";
import {
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
} from "@/utils/apiHandler";

export const useTarifPemeriksaanStore = defineStore({
  id: "tarif-lab",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      params: {
        page?: number;
        limit?: number;
        name?: string;
        penjamins?: string;
        pelayanans?: string;
        payload?: object;
      } = {}
    ) {
      const { page = 1, limit = 10, name = "", penjamins = "", pelayanans = "", payload = {} } = params;
      return apiLaboratoriumGet(
        `/lab/tarif-lab?page=${page}&limit=${limit}&name=${name}&penjamin_uuids=${penjamins}&pelayanans=${pelayanans}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiLaboratoriumPost("/lab/tarif-lab", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/tarif-lab/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiLaboratoriumDelete(`/lab/tarif-lab/${uuid}`, payload);
    },
    async importApi(payload: any) {
      return apiLaboratoriumPost("/lab/tarif-lab/import", payload);
    },
  },
});
