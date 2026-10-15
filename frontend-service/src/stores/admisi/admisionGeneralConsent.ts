import { defineStore } from "pinia";
import {
  apiAdmisiDelete,
  apiAdmisiGet,
  apiAdmisiPost,
} from "@/utils/apiHandler";

export const useAdmisiGeneralConsent = defineStore({
  id: "admisiGeneralConsent",
  state: () => ({}),
  getters: {},
  actions: {
    async getAllPatientGeneralConsent(uuid = "", payload = {}) {
      return apiAdmisiGet(`/general-consent/${uuid}`, payload);
    },

    async getDetailGeneralConsent(uuid = "", payload = {}) {
      return apiAdmisiGet(`/general-consent/detail/${uuid}`, payload);
    },

    async createGeneralConsent(uuid = "", payload = {}) {
      return apiAdmisiPost(`/general-consent/${uuid}`, payload);
    },

    async deleteGeneralConsent(uuid = "", payload = {}) {
      return apiAdmisiDelete(`/general-consent/${uuid}`, payload);
    },
  },
});
