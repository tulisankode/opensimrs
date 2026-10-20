import { defineStore } from "pinia";
import { apiRawatInapGet, apiRawatInapPost } from "@/utils/apiHandler";

export const useNicuStore = defineStore({
  id: "nicu",
  state: () => ({}),
  actions: {
    async baca(path: string, filter: Record<string, string | number> = {}) {
      const query = new URLSearchParams(Object.entries(filter).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)]));
      return apiRawatInapGet(`/nicu/${path}?${query}`, {});
    },
    async simpan(path: string, data: object, kunci: string) {
      return apiRawatInapPost(`/nicu/${path}`, data, { headers: { "Idempotency-Key": kunci } });
    },
  },
});
