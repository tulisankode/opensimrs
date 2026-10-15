import { defineStore } from "pinia";
import { apiFarmasiGet } from "@/utils/apiHandler";

export const useWaitingTimeStore = defineStore({
  id: "waitingTime",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      name: string = "",
      paymentMethod: string = "",
      recipeOrigin: string = "",
      recipe: string = "",
      typeOfService: string = "",
      startDate: number = 0,
      endDate: number = 0,
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiFarmasiGet(
        `/farmasi/rekap/tat?&name=${name}&payment_method=${paymentMethod}&lokasi_uuid=${recipeOrigin}&racikan=${recipe}&jenisPelayanan=${typeOfService}&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=${limit}`,
        payload
      );
    },
  },
});
