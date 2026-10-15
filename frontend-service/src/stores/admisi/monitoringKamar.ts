import { defineStore } from "pinia";
import { apiAdmisiGet, apiAdmisiPatch } from "@/utils/apiHandler";

export const useMonitoringKamarStore = defineStore({
  id: "monitoringKamar",
  state: () => ({rooms: [] as any []}),
  getters: {},
  actions: {
        async getMonitoringKamar(
      {
        page = 1,
        limit = 10,
        q = "",
        filterKelas = "",
        filterKategori = [] as string[],
      },
      payload = {}
    ) {
      let tempFilterKategori = "";
      filterKategori.forEach((kategori, index) => {
        tempFilterKategori += `${kategori}`;
        if (index + 1 < filterKategori.length) {
          tempFilterKategori += ",";
        }
      });

      const response = await apiAdmisiGet(
        `/monitoring-rooms?page=${page}&limit=${limit}&name=${q}&filter_kelas=${filterKelas}&filter_kategori=${tempFilterKategori}`,
        payload
      );

      this.rooms = response.payload;

      return response;
    },
    async updateBed(uuid = "", payload = {}) {
      return apiAdmisiPatch(`/monitoring-rooms/${uuid}`, payload);
    },
    async getAktifRuangan(payload = {}) {
      const response = await apiAdmisiGet("/monitoring-rooms", payload);

      if (response && response.payload) {
        const filtered = response.payload.filter((room: any) => !!room.name);
        return { ...response, payload: filtered };
      }

      return response;
    },
    async getDetailMonitoringKamar(uuid = "", payload = {}) {
      return apiAdmisiGet(`/monitoring-rooms/${uuid}`, payload);
    },
  },
});
