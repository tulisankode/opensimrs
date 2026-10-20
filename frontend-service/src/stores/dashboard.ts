import { defineStore } from "pinia";
import { apiLaporanGet, apiLaporanGetDiam, apiLaporanKirim } from "@/utils/apiHandler";

// Parameter periode & faskes Dashboard Eksekutif. faskesUuid kosong = faskes aktif pada token; daftar faskes lain
// hanya diterima server untuk super admin.
const kueriEksekutif = (startDate: string, endDate: string, faskesUuid: string[] = []) => {
  const q = new URLSearchParams({ startDate, endDate });
  if (faskesUuid.length) q.set("faskes_uuid", faskesUuid.join(","));
  return q.toString();
};

// Rekap dashboard dari laporan-service (/api/v3/laporan/dashboard/rekap/*) dan Dashboard Eksekutif
// (/api/v3/laporan/dashboard/eksekutif*, STD-0034).
export const useDashboardStore = defineStore({
  id: "dashboard",
  state: () => ({}),
  actions: {
    async getRekap(jenis: "" | "rawat-jalan" | "status-rawat" | "gender" | "pendapatan" | "poli" | "dpjp", startDate: string, endDate: string) {
      const path = jenis ? `/dashboard/rekap/${jenis}` : "/dashboard/rekap";
      return apiLaporanGet(`${path}?startDate=${startDate}&endDate=${endDate}`);
    },
    async getEksekutif(startDate: string, endDate: string, faskesUuid: string[] = []) {
      return apiLaporanGet(`/dashboard/eksekutif?${kueriEksekutif(startDate, endDate, faskesUuid)}`);
    },
    async getRincianEksekutif(kode: string, dimensi: string, startDate: string, endDate: string, faskesUuid: string[] = []) {
      return apiLaporanGet(`/dashboard/eksekutif/rincian/${kode}?${kueriEksekutif(startDate, endDate, faskesUuid)}&dimensi=${dimensi}`);
    },
    async eksporEksekutif(startDate: string, endDate: string, faskesUuid: string[] = []) {
      return apiLaporanKirim("post", "/dashboard/eksekutif/ekspor", { startDate, endDate, faskes_uuid: faskesUuid });
    },
    async getTargetEksekutif() {
      return apiLaporanGet("/dashboard/eksekutif/target");
    },
    async simpanTargetEksekutif(target: Array<{ kode: string; target_min: number | null; target_maks: number | null; toleransi_persen: number }>) {
      return apiLaporanKirim("put", "/dashboard/eksekutif/target", { target }, true);
    },
    // Command Center (STD-0037, /api/v3/laporan/command-center/*). Ringkasan dipolling tanpa toast galat.
    async getRingkasanCommandCenter() {
      return apiLaporanGetDiam("/command-center/ringkasan");
    },
    async getPeringatanCommandCenter(status: "aktif" | "riwayat" = "aktif") {
      return apiLaporanGet(`/command-center/peringatan?status=${status}`);
    },
    async tindakanPeringatanCommandCenter(uuid: string, data: { jenis: "tinjau" | "eskalasi"; catatan: string; tujuan?: string | null }) {
      return apiLaporanKirim("post", `/command-center/peringatan/${uuid}/tindakan`, data, true);
    },
    async getAmbangCommandCenter() {
      return apiLaporanGet("/command-center/ambang");
    },
    async simpanAmbangCommandCenter(ambang: Array<{ kode: string; operator: string; batas_peringatan: number | null; batas_kritis: number | null; aktif: boolean }>) {
      return apiLaporanKirim("put", "/command-center/ambang", { ambang }, true);
    },
  },
});
