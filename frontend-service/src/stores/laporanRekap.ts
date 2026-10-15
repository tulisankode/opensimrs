import { defineStore } from "pinia";
import { apiLaporanGet } from "@/utils/apiHandler";

export type JenisRekap = "status-rawat" | "tindakan" | "pemeriksaan-lab" | "diagnosis";

const toQuery = (params: Record<string, unknown>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

// Rekapitulasi laporan global dari laporan-service (/api/v3/laporan/rekap/*)
export const useLaporanRekapStore = defineStore({
  id: "laporanRekap",
  state: () => ({}),
  actions: {
    async getRekap(jenis: JenisRekap, params: Record<string, unknown>) {
      return apiLaporanGet(`/rekap/${jenis}?${toQuery(params)}`);
    },
    async exportRekap(jenis: JenisRekap, params: Record<string, unknown>) {
      return apiLaporanGet(`/rekap/${jenis}/export?${toQuery(params)}`);
    },
  },
});
