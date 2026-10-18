// API Pembelian via Marketplace (STD-0019), inventory-service: /api/v3/inventory/marketplace. Body request
// otomatis snake_case, respons camelCase (lihat apiInventoryGet/Post/Put). Query string TIDAK dikonversi:
// pemanggil menulis kunci snake_case langsung di URL.
import { apiInventoryGet, apiInventoryPost, apiInventoryPut } from "@/utils/apiHandler";
import { defineStore } from "pinia";

type Gaya = { label: string; bg: string; text: string };

export const STATUS_PERSETUJUAN_MARKETPLACE: Record<string, Gaya> = {
  menunggu: { label: "Menunggu Persetujuan", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  disetujui: { label: "Disetujui", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  ditolak: { label: "Ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const STATUS_PESANAN_MARKETPLACE: Record<string, Gaya> = {
  draft: { label: "Draft", bg: "bg-grey-50", text: "text-grey-400" },
  menunggu_konfirmasi: { label: "Menunggu Konfirmasi", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  dibayar: { label: "Dibayar", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  dikemas: { label: "Dikemas", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  dikirim: { label: "Dikirim", bg: "bg-[#EBE9FE]", text: "text-[#5925DC]" },
  diterima_sebagian: { label: "Diterima Sebagian", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  diterima: { label: "Diterima", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  dibatalkan: { label: "Dibatalkan", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
export const gayaPersetujuanMarketplace = (s?: string) => STATUS_PERSETUJUAN_MARKETPLACE[s as string];
export const gayaPesananMarketplace = (s?: string) => STATUS_PESANAN_MARKETPLACE[s as string];

const qs = (params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const useMarketplaceStore = defineStore({
  id: "InventoryMarketplace",
  state: () => ({}),
  getters: {},
  actions: {
    // --- Konfigurasi koneksi ---
    async getKonfigurasi(payload = {}) {
      return apiInventoryGet(`/marketplace/konfigurasi`, payload);
    },
    async putKonfigurasi(data: {
      mitraKode: string;
      namaMitra: string;
      baseUrl: string;
      akunAfiliasi?: string | null;
      supplierUuid: string;
      modeMock?: boolean;
      aktif?: boolean;
      apiKey?: string;
    }) {
      return apiInventoryPut(`/marketplace/konfigurasi`, data);
    },

    // --- Penawaran & pemetaan ---
    async cariPenawaran(params: { mitra_kode: string; q?: string; limit?: number }) {
      return apiInventoryGet(`/marketplace/penawaran${qs(params)}`, {});
    },
    async getKonversiItem(itemUuid: string) {
      return apiInventoryGet(`/marketplace/konversi-item${qs({ item_uuid: itemUuid })}`, {});
    },
    async getPemetaan(params: { mitra_kode?: string; search?: string; page?: number; limit?: number } = {}) {
      return apiInventoryGet(`/marketplace/pemetaan${qs(params)}`, {});
    },
    async putPemetaan(
      produkMitraId: string,
      data: { mitraKode: string; namaProdukMitra?: string; kemasanMitra?: string; itemUuid: string; satuanUuid: string },
    ) {
      return apiInventoryPut(`/marketplace/pemetaan/${encodeURIComponent(produkMitraId)}`, data);
    },

    // --- Permintaan/pesanan ---
    async createPermintaan(data: {
      mitraKode: string;
      jenisStokUuid: string;
      lokasiStokUuid: string;
      kategoriItem: "medis" | "non-medis";
      jenisItem: "obat" | "alkes";
      metodePembelian: "tunai" | "kredit";
      catatan?: string;
      items: Array<{
        produkMitraId: string;
        namaProdukMitra?: string;
        jumlah: number;
        hargaSatuan: number;
        stokPenawaran?: number;
        estimasiKirim?: string;
      }>;
    }) {
      return apiInventoryPost(`/marketplace/permintaan`, data);
    },
    async getListPesanan(params: { status_pesanan?: string; status_persetujuan?: string; mitra_kode?: string; search?: string; page?: number; limit?: number } = {}) {
      return apiInventoryGet(`/marketplace/permintaan${qs(params)}`, {});
    },
    async getDetailPesanan(uuid: string) {
      return apiInventoryGet(`/marketplace/permintaan/${uuid}`, {});
    },
    async persetujuan(uuid: string, data: { keputusan: "setujui" | "tolak"; alasan?: string }) {
      return apiInventoryPost(`/marketplace/permintaan/${uuid}/persetujuan`, data);
    },
    async checkout(uuid: string) {
      return apiInventoryPost(`/marketplace/permintaan/${uuid}/checkout`, {});
    },
    async sinkronStatus(uuid: string) {
      return apiInventoryPost(`/marketplace/permintaan/${uuid}/sinkron-status`, {});
    },
    async getPenerimaan(uuid: string) {
      return apiInventoryGet(`/marketplace/permintaan/${uuid}/penerimaan`, {});
    },

    // --- Laporan ---
    async laporan(params: { dari?: number; sampai?: number; status?: string; mitra_kode?: string; page?: number; limit?: number } = {}) {
      return apiInventoryGet(`/marketplace/laporan${qs(params)}`, {});
    },
  },
});
