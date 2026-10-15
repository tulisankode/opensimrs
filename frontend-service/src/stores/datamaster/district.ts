import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useDistrictStore = defineStore({
  id: "district",
  state: () => ({}),
  getters: {},
  actions: {
    async getProvinsiApi(payload = {}) {
      return apiDatamasterGet("/datamaster/provinsi", payload);
    },
    async getKabupatenApi(code: string = "", payload = {}) {
      return apiDatamasterGet(
        `/datamaster/kabupaten?provinsi_code=${code}`,
        payload
      );
    },
    async getKecamatanApi(code: string = "", payload = {}) {
      return apiDatamasterGet(
        `/datamaster/kecamatan?kabupaten_code=${code}`,
        payload
      );
    },
    async getKelurahanApi(code: string = "", payload = {}) {
      return apiDatamasterGet(
        `/datamaster/kelurahan?kecamatan_code=${code}`,
        payload
      );
    },
  },
});