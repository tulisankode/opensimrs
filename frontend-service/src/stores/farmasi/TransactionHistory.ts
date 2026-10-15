import { defineStore } from "pinia";
import { apiFarmasiPost, apiFarmasiDelete } from "@/utils/apiHandler";

export const useTransactionHistoryStore = defineStore({
  id: "TransactionHistory",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(payload = {}) {
      return apiFarmasiPost("/farmasi/riwayat/all", payload);
    },
    async getApiDetail(payload = {}) {
      return apiFarmasiPost("/farmasi/riwayat/detail", payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(`/farmasi/penjualan-obat/${uuid}`, payload);
    },
  },
});
