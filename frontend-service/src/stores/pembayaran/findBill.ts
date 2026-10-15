import { defineStore } from "pinia";
import {
  apiPembayaranGet,
  apiPembayaranPost,
  apiPembayaranPut,
  apiPembayaranDelete,
} from "@/utils/apiHandler";

export const useTagihanStore = defineStore({
  id: "search",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      search: string = "",

      payload = {}
    ) {
      return apiPembayaranGet(`/payment/payment?search=${search} `, payload);
    },
    async getDetailBill(uuid: string, payload = {}) {
      return apiPembayaranGet(`/payment/${uuid}`, payload);
    },
    async getCloseDayConfirmation(payload = {}) {
      return apiPembayaranGet(`/payment/cashier/close-day/check`, payload);
    },
    async getItemBill(uuid: string, payload = {}) {
      return apiPembayaranGet(`/payment/${uuid}/items`, payload);
    },
    async getKasirStatus(payload = {}) {
      return apiPembayaranGet(`/payment/cashier/check`, payload);
    },
    async postVoucher(uuid: string, payload = {}) {
      return apiPembayaranPost(`/payment/${uuid}/voucher`, payload);
    },
    async postDiscount(uuid: string, payload = {}) {
      return apiPembayaranPost(`/payment/${uuid}/discount`, payload);
    },
    async postKasirCloseBill(uuid: string, payload = {}) {
      return apiPembayaranPost(`/payment/${uuid}/close`, payload);
    },
    async postOpenKasir(payload = {}) {
      return apiPembayaranPost(`/payment/cashier/open`, payload);
    },
    async postCloseKasir(payload = {}) {
      return apiPembayaranPost(`/payment/cashier/close`, payload);
    },
    async postCloseHarianKasir(payload = {}) {
      return apiPembayaranPost(`/payment/cashier/close/day`, payload);
    },
    async postPayment(uuid: string, payload = {}) {
      return apiPembayaranPost(`/payment/${uuid}/payment`, payload);
    },
  },
});
