import { defineStore } from "pinia";
import { apiBpjsGet, apiBpjsPost, apiBpjsPut } from "@/utils/apiHandler";

// Antrean Online BPJS (Mobile JKN) — konfigurasi, monitoring & kirim ulang (bpjs-service, /api/v3/bpjs/antrean).
export const useAntreanBpjsStore = defineStore({
  id: "antreanBpjs",
  state: () => ({}),
  actions: {
    async getKonfigurasi() {
      return apiBpjsGet("/antrean/konfigurasi");
    },
    async simpanKonfigurasi(payload: Record<string, unknown>) {
      return apiBpjsPut("/antrean/konfigurasi", payload);
    },
    async getMonitoring({ page = 1, limit = 20, status = "", tanggal = "" } = {}) {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set("status", status);
      if (tanggal) params.set("tanggal", tanggal);
      return apiBpjsGet(`/antrean/monitoring?${params.toString()}`);
    },
    async getDetailBooking(kodeBooking: string) {
      return apiBpjsGet(`/antrean/booking/${encodeURIComponent(kodeBooking)}`);
    },
    async kirimUlang(kodeBooking: string, payload: { jenis: string; task_id?: number }) {
      return apiBpjsPost(`/antrean/booking/${encodeURIComponent(kodeBooking)}/kirim-ulang`, payload);
    },
  },
});
