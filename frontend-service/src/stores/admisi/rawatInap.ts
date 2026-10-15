import { defineStore } from "pinia";
import {
  apiAdmisiGet,
  apiAdmisiPost,
  apiAdmisiPut,
  apiAdmisiDelete,
} from "@/utils/apiHandler";

export const useAdmisiRIStore = defineStore({
  id: "admisiRI",
  state: () => ({}),
  getters: {},
  actions: {
    async getRI(
      {
        q = "",
        paymentMethod = "",
        page = 1,
        limit = 10,
        room = [] as string[],
        startDate = "",
        endDate = "",
        dpjp = "",
        status = ""
      },
      payload = {}
    ) {
      let tempFilterRoom = "";
      room.forEach((roomData, index) => {
        tempFilterRoom += `${roomData}`;
        if (index + 1 < room.length) {
          tempFilterRoom += ",";
        }
      });
      return apiAdmisiGet(
        `/rawat-inap?q=${q}&payment_method=${paymentMethod}&page=${page}&limit=${limit}&room=${tempFilterRoom}&start_date=${startDate}&end_date=${endDate}&dpjp=${dpjp}&status=${status}`,
        payload
      );
    },
    async registNewBorn(payload = {}) {
      return apiAdmisiPost("/rawat-inap", payload);
    },
    async updateRI(uuid: string = "", payload = {}) {
      return apiAdmisiPut(`/rawat-inap/${uuid}`, payload);
    },
    async getDetailRI(uuid: string = "", payload = {}) {
      return apiAdmisiGet(`/rawat-inap/${uuid}`, payload);
    },
    async cancelVisitRI(payload = {}) {
      return apiAdmisiDelete("/rawat-inap/cancel", payload);
    },
  },
});
