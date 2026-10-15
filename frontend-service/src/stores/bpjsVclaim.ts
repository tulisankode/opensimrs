import { defineStore } from "pinia";
import { apiBpjsDelete, apiBpjsGet, apiBpjsPost, apiBpjsPut } from "@/utils/apiHandler";

// Integrasi BPJS VClaim / SEP (bpjs-service, /api/v3/bpjs/vclaim)
export const useBpjsVclaimStore = defineStore({
  id: "bpjsVclaim",
  state: () => ({}),
  actions: {
    async getKonfigurasi() {
      return apiBpjsGet("/vclaim/konfigurasi");
    },
    async simpanKonfigurasi(payload: Record<string, unknown>) {
      return apiBpjsPut("/vclaim/konfigurasi", payload);
    },
    async ujiKoneksi() {
      return apiBpjsPost("/vclaim/uji-koneksi");
    },
    async cekPeserta(nomor: string, tgl = "") {
      return apiBpjsGet(`/vclaim/peserta/${encodeURIComponent(nomor)}${tgl ? `?tgl=${tgl}` : ""}`);
    },
    async getRujukan(noKartu: string) {
      return apiBpjsGet(`/vclaim/rujukan/${encodeURIComponent(noKartu)}`);
    },
    async getReferensi(jenis: "diagnosa" | "poli" | "dokter", params: Record<string, string> = {}) {
      const query = new URLSearchParams(params).toString();
      return apiBpjsGet(`/vclaim/referensi/${jenis}${query ? `?${query}` : ""}`);
    },
    async getPasien(noKartu: string) {
      return apiBpjsGet(`/vclaim/pasien/${encodeURIComponent(noKartu)}`);
    },
    async getSep({ page = 1, limit = 10, q = "", status = "aktif", sumber = "" }) {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), q, status, sumber });
      return apiBpjsGet(`/vclaim/sep?${params.toString()}`);
    },
    async buatSep(payload: Record<string, unknown>) {
      return apiBpjsPost("/vclaim/sep", payload);
    },
    async hapusSep(noSep: string) {
      return apiBpjsDelete(`/vclaim/sep/${encodeURIComponent(noSep)}`);
    },
    async getPemetaanPoli() {
      return apiBpjsGet("/vclaim/pemetaan-poli");
    },
    async simpanPemetaanPoli(poli: { uuid: string; kdPoliVclaim: string | null }[]) {
      return apiBpjsPut("/vclaim/pemetaan-poli", { poli });
    },
  },
});
