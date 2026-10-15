import { defineStore } from "pinia";
import { apiLisDelete, apiLisGet, apiLisPost, apiLisPut } from "@/utils/apiHandler";

// Bridging LIS (adamLIS) — lab-service /lab/lis. Satu faskes boleh punya lebih dari satu LIS.
export const useLisStore = defineStore({
  id: "lis",
  state: () => ({}),
  actions: {
    async getKoneksi() {
      return apiLisGet("/lab/lis/koneksi");
    },
    async simpanKoneksi(uuid: string | null, payload: Record<string, unknown>) {
      return uuid ? apiLisPut(`/lab/lis/koneksi/${uuid}`, payload) : apiLisPost("/lab/lis/koneksi", payload);
    },
    async jadikanBawaan(uuid: string) {
      return apiLisPut(`/lab/lis/koneksi/${uuid}/bawaan`);
    },
    async buatUlangKunciMasuk(uuid: string) {
      return apiLisPost(`/lab/lis/koneksi/${uuid}/kunci-masuk`);
    },
    async hapusKoneksi(uuid: string) {
      return apiLisDelete(`/lab/lis/koneksi/${uuid}`);
    },
    async getPemetaanItem() {
      return apiLisGet("/lab/lis/pemetaan-item");
    },
    async simpanPemetaanItem(items: { uuid: string; kode_lis: string | null }[]) {
      return apiLisPut("/lab/lis/pemetaan-item", { items });
    },
    async getPemetaanTarif() {
      return apiLisGet("/lab/lis/pemetaan-tarif");
    },
    async simpanPemetaanTarif(items: { uuid: string; kode_lis: string | null }[]) {
      return apiLisPut("/lab/lis/pemetaan-tarif", { items });
    },
    async getPemetaanRef() {
      return apiLisGet("/lab/lis/pemetaan-ref");
    },
    async simpanPemetaanRef(items: { jenis: string; uuid: string; kode_lis: string | null; nama_lis: string | null }[]) {
      return apiLisPut("/lab/lis/pemetaan-ref", { items });
    },
    async getKirim({ page = 1, limit = 10, status = "" }) {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
      return apiLisGet(`/lab/lis/kirim?${params.toString()}`);
    },
    async kirimOrder(orderUuid: string, koneksiUuid: string | null = null) {
      return apiLisPost(`/lab/lis/kirim/${orderUuid}`, koneksiUuid ? { koneksi_uuid: koneksiUuid } : {});
    },
    async tarikHasil(orderUuid: string) {
      return apiLisPost(`/lab/lis/tarik/${orderUuid}`, {});
    },
    async statusKirimOrder(orderUuid: string) {
      return apiLisGet(`/lab/lis/kirim/${orderUuid}`);
    },
  },
});
