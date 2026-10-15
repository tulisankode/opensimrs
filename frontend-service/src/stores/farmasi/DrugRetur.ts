import { defineStore } from "pinia";
import {
  apiFarmasiGet,
  apiFarmasiPost,
  apiFarmasiPut,
  apiFarmasiDelete,
  apiRekamMedisGet,
} from "@/utils/apiHandler";

export const useDrugReturStore = defineStore({
  id: "DrugRetur",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      itemType: string = "",
      startDate: number = 0,
      endDate: number = 0,
      search: string = "",
      lokasi: string = "",
      payment: string = "",
      page: number = 1,
      limit: number = 10,
      payload = {}
    ) {
      return apiFarmasiGet(
        `/farmasi/retur/all?item_type=${itemType}&start_date=${startDate}&end_date=${endDate}&search=${search}&lokasi_stok_uuid=${lokasi}&payment_method=${payment}&page=${page}&limit=${limit}`,
        payload
      );
    },
    async getApiDetailObat(obatUuid: string, payload = {}) {
      return apiFarmasiGet(
        `/farmasi/retur/detail?item_type=obat&prescription_uuid=${obatUuid}`,
        payload
      );
    },
    async getAssesmentMedis(rekamMedisUuid = "", payload = {}) {
      return apiRekamMedisGet(
        `/rekam-medis/patient?rekam_medis_uuid=${rekamMedisUuid}`,
        payload
      );
    },
    async getApiDetailAlkes(alkesUuid: string, payload = {}) {
      return apiFarmasiGet(
        `/farmasi/retur/detail?item_type=alkes&order_alkes_uuid=${alkesUuid}`,
        payload
      );
    },
    async createApi(payload = {}) {
      return apiFarmasiPost("/farmasi/retur", payload);
    },
  },
});
