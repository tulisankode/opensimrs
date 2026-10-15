import { defineStore } from "pinia";
import { apiSatuSehatGet, apiSatuSehatPost } from "@/utils/apiHandler";

// Integrasi SATUSEHAT (satusehat-service, /api/v3/satusehat)
export const useSatuSehatStore = defineStore({
  id: "satusehat",
  state: () => ({}),
  actions: {
    async getStatus() {
      return apiSatuSehatGet("/status");
    },
    async ujiKoneksi() {
      return apiSatuSehatPost("/uji-koneksi");
    },
    async getSinkron({ page = 1, limit = 10, status = "", q = "" }) {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status, q });
      return apiSatuSehatGet(`/sinkron?${params.toString()}`);
    },
    async kirimRawatJalan(uuid: string) {
      return apiSatuSehatPost(`/sinkron/rawat-jalan/${uuid}`);
    },
    async jalankanPekerja() {
      return apiSatuSehatPost("/pekerja/jalankan");
    },
  },
});
