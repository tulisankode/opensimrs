import { defineStore } from "pinia";
import {
  apiAdmisiGet,
  apiAdmisiPost,
  apiAdmisiPut,
  apiAdmisiDelete,
} from "@/utils/apiHandler";

export const useAdmisiRJStore = defineStore({
  id: "admisiRJ",
  state: () => ({}),
  getters: {},
  actions: {
    // FIXME Belum bisa multiple untuk platform dan poli
    // FIXME Belum bisa berjalan untuk dpjp
    async getRJ(
      {
        q = "",
        paymentMethod = "",
        page = 1,
        limit = 10,
        platform = "",
        poly = [] as string[],
        startDate = "",
        endDate = "",
        dpjp = "",
        status = "",
      },
      payload = {}
    ) {
      let tempFilterPoli = "";
      poly.forEach((poli, index) => {
        tempFilterPoli += `${poli}`;
        if (index + 1 < poly.length) {
          tempFilterPoli += ",";
        }
      });
      console.log(poly);
      return apiAdmisiGet(
        `/rawat-jalan?q=${q}&payment_method=${paymentMethod}&page=${page}&limit=${limit}&platform=${platform}&poly=${poly}&start_date=${startDate}&end_date=${endDate}&dpjp=${dpjp}&status=${status}`,
        payload
      );
    },
    async registRJ(payload = {}) {
      return apiAdmisiPost("/rawat-jalan", payload);
    },
    async updateRJ(uuid: string = "", payload = {}) {
      return apiAdmisiPut(`/rawat-jalan/${uuid}`, payload);
    },
    async getDetailRJ(uuid: string = "", payload = {}) {
      return apiAdmisiGet(`/rawat-jalan/${uuid}`, payload);
    },
    async cancelVisitRJ(payload = {}) {
      return apiAdmisiDelete("/rawat-jalan/cancel", payload);
    },
    // FIXME Dummy
    // JADWAL YANG HARUS DIGANTI
    async getListJadwalDokter(payload = {}) {
      return apiAdmisiGet(`/rawat-jalan/jadwal-dokter`, payload);
    },
  },
});
