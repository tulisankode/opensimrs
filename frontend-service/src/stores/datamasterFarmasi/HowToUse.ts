import { defineStore } from "pinia";
import { apiFarmasiGet, apiFarmasiPost, apiFarmasiPut, apiFarmasiDelete } from "@/utils/apiHandler";

export const useHowToUseStore = defineStore({
  id: "cara-pakai",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      limit: number = 10,
      cara_pakai: String = "",
      jenisLokasi: String = "",
      kodeTujuan: String = "",
      payload = {}
    ) {
      return apiFarmasiGet(
        `/farmasi/datamaster/cara-pakai?page=${page}&limit=${limit}&cara_pakai=${cara_pakai}&jenis_lokasi=${jenisLokasi}&kode_tujuan=${kodeTujuan}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiFarmasiPost("/farmasi/datamaster/cara-pakai", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/datamaster/cara-pakai/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(
        `/farmasi/datamaster/cara-pakai/${uuid}`,
        payload
      );
    },
    async exportApi(payload = {}) {
      return apiFarmasiGet(`/farmasi/datamaster/cara-pakai/export`, payload);
    },
    async importApi(payload: any) {
      return apiFarmasiPost("/farmasi/datamaster/cara-pakai/import", payload);
    },
  },
});
