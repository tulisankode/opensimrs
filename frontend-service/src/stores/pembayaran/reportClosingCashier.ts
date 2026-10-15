import { defineStore } from "pinia";
import { apiPembayaranGet } from "@/utils/apiHandler";

export const useReportCloseCashierStore = defineStore({
  id: "closeCashier",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      limit: number = 10,
      startDate: number = 0,
      endDate: number = 0,
      type: string = "",
    
      payload = {}
    ) {
      return apiPembayaranGet(
        `/payment/report/cashier?&start_date=${startDate}&end_date=${endDate}&page=${page}&limit=${limit}&type=${type}`,
        payload
      );
    },
    async exportApi(payload = {}) {
      return apiPembayaranGet(`/report/cashier/export`, payload);
    },
  },
});
