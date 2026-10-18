import { defineStore } from "pinia";
import { apiLaporanGet } from "@/utils/apiHandler";

// Rekap dashboard dari laporan-service (/api/v3/laporan/dashboard/rekap/*)
export const useDashboardStore = defineStore({
  id: "dashboard",
  state: () => ({}),
  actions: {
    async getDashboardEksekutif(startDate: string, endDate: string) {
      return apiLaporanGet(`/dashboard/eksekutif?startDate=${startDate}&endDate=${endDate}`);
    },
    async getRekap(jenis: "" | "rawat-jalan" | "status-rawat" | "gender" | "pendapatan" | "poli" | "dpjp", startDate: string, endDate: string) {
      const path = jenis ? `/dashboard/rekap/${jenis}` : "/dashboard/rekap";
      return apiLaporanGet(`${path}?startDate=${startDate}&endDate=${endDate}`);
    },
  },
});
