import { defineStore } from "pinia";
import { apiLaboratoriumGet } from "@/utils/apiHandler";

export const useRekapPerTanggal = defineStore({
  id: "laporan-rekap-per-tanggal",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      { startDate = "", endDate = "", search = "" },
      payload = {}
    ) {
      return apiLaboratoriumGet(
        `/lab/rekap-pemeriksaan-per-tanggal?start_date=${startDate}&end_date=${endDate}&search=${search}`,
        payload
      );
    },
  },
});
