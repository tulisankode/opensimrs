import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useKomponenTarifStore = defineStore({
  id: "komponenTarif",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
      return apiDatamasterGet(`/datamaster/komponen-tarif?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async getAktifApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/komponen-tarif/aktif`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/komponen-tarif", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/komponen-tarif/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/komponen-tarif/${uuid}`, payload);
    },
    async exportApi(payload = {}) {      
      return apiDatamasterGet(`/datamaster/komponen-tarif/export`, payload);
    },
    async importApi(payload: any) {
      return apiDatamasterPost("/datamaster/komponen-tarif/import", payload);
    },
  },
});
