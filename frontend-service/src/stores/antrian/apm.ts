import { apiAdmisiPost, apiAntrianPost } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useApmStore = defineStore({
  id: "apm",
  state: () => ({}),
  getters: {},
  actions: {
    async checkPasien(payload: {}) {
      return await apiAdmisiPost(`/patient/check-patient/apm`, payload);
    },
    async printPasien(payload: {}) {
      return await apiAntrianPost(`/apm/print-antrian`, payload);
    },
    async AntrianObat(payload: {}) {
      return await apiAntrianPost(`/apm/antrian-farmasi`, payload);
    },
    async AntrianCheckIn(payload: {}) {
      return await apiAntrianPost(`/apm/check-in`, payload);
    },
    async register(payload: {}) {
      return await apiAntrianPost(`/apm/register`, payload);
    },
  },
});
