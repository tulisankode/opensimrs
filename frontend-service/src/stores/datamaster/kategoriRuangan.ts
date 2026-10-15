import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useKategoriRuanganStore = defineStore({
    id: "kategoriRuangan",
    state: () => ({}),
    getters: {},
    actions: {
      async getApi(page: number = 1, limit: number = 10,name:String="", payload = {}) {      
        return apiDatamasterGet(`/datamaster/kategori_ruangan?page=${page}&limit=${limit}&name=${name}`, payload);
      },
      async getAktifApi(payload = {}) {      
        return apiDatamasterGet(`/datamaster/kategori_ruangan/aktif`, payload);
      },
      async postApi(payload = {}) {
        return apiDatamasterPost("/datamaster/kategori_ruangan", payload);
      },
      async putApi(uuid: string, payload = {}) {
        return apiDatamasterPut(`/datamaster/kategori_ruangan/${uuid}`, payload);
      },
      async deleteApi(uuid: string, payload = {}) {
        return apiDatamasterDelete(`/datamaster/kategori_ruangan/${uuid}`, payload);
      },
      async exportApi(payload = {}) {      
        return apiDatamasterGet(`/datamaster/kategori_ruangan/export`, payload);
      },
      async importApi(payload: any) {
        return apiDatamasterPost("/datamaster/kategori_ruangan/import", payload);
      },
    },
  });