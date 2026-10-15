import { defineStore } from "pinia";
import { apiAdmisiGet, apiAdmisiPost, apiAdmisiPut, apiAdmisiDelete } from "@/utils/apiHandler";

export const useAdmisiMasterPasienStore = defineStore({
  id: "admisiMasterPasien",
  state: () => ({}),
  getters: {},
  actions: {
    async getMasterPasien({ page = 1, limit = 10, q = "", status = "" }, payload = {}) {
      return apiAdmisiGet(
        `/patient?page=${page}&limit=${limit}&q=${q}&status=${status}`,
        payload
      );
    },

    async getDetailMasterPasien(uuid = "", payload = {}) {
      return apiAdmisiGet(`/patient/${uuid}`, payload);
    },

    async getPasienHistory({ uuid = "", page = 1, limit = 5 }, payload = {}) {
      return apiAdmisiGet(`/patient/history/${uuid}?page=${page}&limit=${limit}`, payload);
    },

    async createMasterPasien(payload = {}) {
      return apiAdmisiPost(`/patient`, payload);
    },

    async updateMasterPasien(uuid = "", payload = {}) {
      return apiAdmisiPut(`/patient/${uuid}`, payload);
    },

    async getPatientHistory(uuid = "", { page = 1, limit = 10 }) {
      return apiAdmisiGet(
        `/patient/history/${uuid}?page=${page}&limit=${limit}`,
        {}
      );
    },
    async importMasterPasien(payload = {}) {
      return apiAdmisiPost(`/patient/import`, payload);
    },
    async getBerkasApi(uuid = "", payload = {}) {
      return apiAdmisiGet(`/file/${uuid}`, payload);
    },
    async uploadBerkasApi(uuid = "", file: File) {
      const formData = new FormData();
      formData.append("unggah_berkas", file); 

      return apiAdmisiPut(`/file/${uuid}`, formData);
    },
    async deleteBerkasApi(pasienUuid = "", fileUuid = "") {
      return apiAdmisiDelete(`/file/${pasienUuid}`, { uuid: fileUuid });
    },
    async deletePasienApi(payload = {}) {
      return apiAdmisiDelete(`/patient/cancel`, payload);
    }
  },
});
