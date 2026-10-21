import { defineStore } from "pinia";
import {
  apiFarmasiGet,
  apiFarmasiPost,
  apiFarmasiPut,
  apiFarmasiDelete,
} from "@/utils/apiHandler";

export const useDrugSalesStore = defineStore({
  id: "DrugSales",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      status: string = "",
      startDate: number = 0,
      endDate: number = 0,
      lokasi: string = "",
      search: string = "",
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiFarmasiGet(
        `/farmasi/penjualan-obat?status=${status}&start_date=${startDate}&end_date=${endDate}&lokasi=${lokasi}&search=${search}&page=${page}&limit=${limit}`,
        payload
      );
    },
    async getApiDetail(uuid: string, payload = {}) {
      return apiFarmasiGet(`/farmasi/penjualan-obat/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/penjualan-obat/${uuid}/cancel`, payload);
    },
    // Catat pembayaran penjualan bebas di apotek (belum_lunas -> lunas)
    async bayarApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/penjualan-obat/${uuid}/bayar`, payload);
    },
    async getCode(payload = {}) {
      return apiFarmasiGet("/farmasi/penjualan-obat/code", payload);
    },
    async createApi(payload = {}) {
      return apiFarmasiPost("/farmasi/penjualan-obat", payload);
    },
  },
});
