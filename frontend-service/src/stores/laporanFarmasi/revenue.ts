import { defineStore } from "pinia";
import { apiFarmasiGet } from "@/utils/apiHandler";

export const useRevenueStore = defineStore({
  id: "revenue",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      startDate: number = 0,
      endDate: number = 0,
      recipeOrigin: string = "",
      typeOfService: string = "",
      paymentMethod: string = "",
      name: string = "",
      revenue: string = "",
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiFarmasiGet(
        `/farmasi/rekap/pendapatan?&start_date=${startDate}&end_date=${endDate}&lokasi_uuid=${recipeOrigin}&jenis_pelayanan=${typeOfService}&payment_method=${paymentMethod}&search=${name}&pendapatan=${revenue}&page=${page}&limit=${limit}`,
        payload
      );
    },
  },
});
