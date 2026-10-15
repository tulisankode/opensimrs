import { defineStore } from "pinia";
import { apiFarmasiGet, apiFarmasiPost, apiFarmasiPut, apiFarmasiDelete } from "@/utils/apiHandler";

export const usePriceConfigurationStore = defineStore({
  id: "PriceConfiguration",
  state: () => ({}),
  getters: {},
  actions: {
    async getApiKonfig(payload = {}) {
      return apiFarmasiGet("/farmasi/datamaster/konfig-harga", payload);
    },
    async putApiKonfig(payload = {}) {
      return apiFarmasiPut("/farmasi/datamaster/konfig-harga", payload);
    },
    async getApi(page: number = 1, limit: number = 10, payload = {}) {
      return apiFarmasiGet(`/farmasi/datamaster/bentuk-racikan?page=${page}&limit=${limit}`, payload);
    },
    async postApi(payload = {}) {
      return apiFarmasiPost("/farmasi/datamaster/bentuk-racikan", payload);
    },
    async getRacikanApi(payload = {}) {
      return apiFarmasiGet("/farmasi/datamaster/bentuk-racikan", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/datamaster/bentuk-racikan/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(`/farmasi/datamaster/bentuk-racikan/${uuid}`, payload);
    },
  },
});
