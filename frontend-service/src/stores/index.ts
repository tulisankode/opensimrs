import { defineStore } from "pinia";
import { apiBaseGet } from "@/utils/apiHandler";

export const useIndexStore = defineStore({
  id: "index",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(payload = {}) {
      return apiBaseGet("artworks/search", payload);
    },
  },
});
