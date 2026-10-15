import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useLokasiStore = defineStore({
  id: "lokasi",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      limit: number = 10,
      name: String = "",
      payload = {}
    ) {
      return apiDatamasterGet(
        `/datamaster/lokasi?page=${page}&limit=${limit}&search=${name}`,
        payload
      );
    },
    async getByPartOfApi(
      partOfUuid: string,
      payload = {}
    ) {
      return apiDatamasterGet(`/datamaster/lokasi/part_of/${partOfUuid}`, payload);
    },
    async getAktifApi(
      params: { type: string; isPoli: string | boolean } = {
        type: "",
        isPoli: "",
      },
      payload = {}
    ) {
      return apiDatamasterGet(
        `/datamaster/lokasi/aktif?type=${params.type}&is_poli=${params.isPoli}`,
        payload
      );
    },
    async getByCodeApi(code = "", payload = {}) {
      return apiDatamasterGet(`/datamaster/lokasi/code/${code}`, payload);
    },
    // Lokasi IGD faskes untuk rekam medis IGD. Kode lokasi berbeda per faskes (mis. "IGD", "RSA-IGD"), jadi dicari dari
    // daftar lokasi faskes: pelayanan IGD (utamakan kode "IGD" / berakhiran "-IGD", lalu tipe Ward). Bentuk hasil sama
    // dengan getByCodeApi ({ payload: lokasi } atau undefined bila tidak ada).
    async getLokasiIgdApi() {
      const res = await apiDatamasterGet(`/datamaster/lokasi?page=1&limit=1000`, {});
      const daftar: any[] = res?.payload?.data ?? res?.payload ?? [];
      const igd = daftar.filter((l) => l?.pelayanan === "IGD" || /(^|-)IGD$/i.test(l?.code ?? ""));
      const pilih =
        igd.find((l) => /(^|-)IGD$/i.test(l.code ?? "")) ??
        igd.find((l) => (l.locationType ?? l.location_type) === "Ward") ??
        igd[0];
      return pilih ? { payload: pilih } : undefined;
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/lokasi", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/lokasi/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/lokasi/${uuid}`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/lokasi/export`, payload);
    },
    async importApi(payload = {}) {
      return apiDatamasterPost("/datamaster/lokasi/import", payload);
    },
  }
});
