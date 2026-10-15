import { defineStore } from "pinia";
import { apiBpjsGet, apiBpjsPost, apiBpjsPut } from "@/utils/apiHandler";

// Integrasi BPJS PCare (bpjs-service, /api/v3/bpjs/pcare)
export const useBpjsPcareStore = defineStore({
  id: "bpjsPcare",
  state: () => ({}),
  actions: {
    async getKonfigurasi() {
      return apiBpjsGet("/pcare/konfigurasi");
    },
    async simpanKonfigurasi(payload: Record<string, unknown>) {
      return apiBpjsPut("/pcare/konfigurasi", payload);
    },
    async ujiKoneksi() {
      return apiBpjsPost("/pcare/uji-koneksi");
    },
    async getReferensi(jenis: "poli" | "dokter" | "kesadaran" | "diagnosa" | "status-pulang", q = "") {
      return apiBpjsGet(`/pcare/referensi/${jenis}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    },
    async cekPeserta(nomor: string) {
      return apiBpjsGet(`/pcare/peserta/${encodeURIComponent(nomor)}`);
    },
    async getPemetaan() {
      return apiBpjsGet("/pcare/pemetaan");
    },
    async simpanPemetaan(payload: { poli?: any[]; dokter?: any[] }) {
      return apiBpjsPut("/pcare/pemetaan", payload);
    },
    async getKunjungan({ page = 1, limit = 10, status = "", q = "" }) {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status, q });
      return apiBpjsGet(`/pcare/kunjungan?${params.toString()}`);
    },
    async kirimKunjungan(uuid: string) {
      return apiBpjsPost(`/pcare/kunjungan/${uuid}/kirim`);
    },
    async jalankanPekerja() {
      return apiBpjsPost("/pcare/pekerja/jalankan");
    },
  },
});
