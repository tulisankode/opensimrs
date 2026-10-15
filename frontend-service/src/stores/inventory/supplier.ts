import { apiInventoryGet, apiInventoryPost, apiInventoryPut, apiInventoryDelete } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useSupplierStore = defineStore({
  id: "supplier",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi( page: number = 1, limit: number = 10, name: String = "", payload = {} ) {
      return apiInventoryGet(`/inventory/datamaster/supplier?page=${page}&limit=${limit}&name=${name}`, payload);
    },
    async getApiAktif( payload = {} ) {
      return apiInventoryGet(`/inventory/datamaster/supplier/aktif?status=true`, payload);
    },
    async postApi(payload = {}) {
      return apiInventoryPost("/inventory/datamaster/supplier", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiInventoryPut(`/inventory/datamaster/supplier/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiInventoryDelete(`/inventory/datamaster/supplier/${uuid}`, payload);
    },
    async importApi(payload = {}) {
      return apiInventoryPost(`/inventory/datamaster/supplier/import`, payload);
    },
  },
});
