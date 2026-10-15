import { defineStore } from "pinia";
import {
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
} from "@/utils/apiHandler";

export const useOrderLab = defineStore({
  id: "order-lab-lab",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      {
        search = "",
        paymentMethod = "",
        page = 1,
        limit = 10,
        startDate = "",
        endDate = "",
        status = "",
        orderStatus = "",
      },
      payload = {}
    ) {
      return apiLaboratoriumGet(
        `/lab/order-lab?search=${search}&payment_method=${paymentMethod}&page=${page}&limit=${limit}&start_date=${startDate}&end_date=${endDate}&status=${status}&order_status=${orderStatus}`,
        payload
      );
    },
    async postApi(payload = {}) {
      return apiLaboratoriumPost("/lab/order-lab", payload);
    },
    async putApiBatalOrder(payload = {}) {
      return apiLaboratoriumPut(`/lab/order-lab-batal`, payload);
    },
    async putApiValidasi(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/order-lab-validasi/${uuid}`, payload);
    },
    async putApiEdit(uuid: string, payload = {}) {
      return apiLaboratoriumPut(`/lab/order-lab/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiLaboratoriumDelete(`/lab/order-lab/${uuid}`, payload);
    },
    async getDetailPasien(uuid = "", payload = {}) {
      return apiLaboratoriumGet(`/lab/order-lab/${uuid}`, payload);
    },
    async getActive(payload = {}) {
      return apiLaboratoriumGet(`/lab/tarif-lab/active`, payload);
    },
  },
});
