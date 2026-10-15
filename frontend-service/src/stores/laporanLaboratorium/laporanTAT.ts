import { defineStore } from "pinia";
import { apiLaboratoriumGet } from "@/utils/apiHandler";

export const useLaporanTat = defineStore({
  id: "laporan-tat",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      {
        startDate = "",
        endDate = "",
        jenisPelayanan = "",
        search = "",
        page = 1,
        limit = 10,
      },
      payload = {}
    ) {
      return apiLaboratoriumGet(
        `/lab/laporan-tat?start_date=${startDate}&end_date=${endDate}&pelayanan=${jenisPelayanan}&search=${search}&page=${page}&limit=${limit}`,
        payload
      );
    },
  },
});
