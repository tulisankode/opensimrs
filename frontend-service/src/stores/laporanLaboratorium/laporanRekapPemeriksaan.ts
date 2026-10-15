import { defineStore } from "pinia";
import { apiLaboratoriumGet } from "@/utils/apiHandler";

export const useRekapPemeriksaan = defineStore({
  id: "rekap-pemeriksaan",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      {
        startDate = "",
        endDate = "",
        search = "",
      },
      payload = {}
    ) {
      return apiLaboratoriumGet(
        `/lab/rekap-pemeriksaan?start_date=${startDate}&end_date=${endDate}&search=${search}`,
        payload
      );
    },
  },
});