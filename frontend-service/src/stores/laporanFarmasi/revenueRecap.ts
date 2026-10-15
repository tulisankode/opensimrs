import { defineStore } from "pinia";
import { apiFarmasiGet } from "@/utils/apiHandler";

export const useRevenueRecapStore = defineStore({
  id: "revenueRecap",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      limit: number = 10,
      startDate: number = 0,
      endDate: number = 0,
      paymentMethod: number = 0,
      location: string = "",
      payload = {}
    ) {
      return apiFarmasiGet(`/farmasi/rekap/pendapatan-apotik?&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=${limit}&payment_method=${paymentMethod}&lokasi_stok_uuid=${location}`, payload);
    },
  },
});
