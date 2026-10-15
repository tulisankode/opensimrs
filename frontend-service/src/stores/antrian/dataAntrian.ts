import {
  apiAdmisiGet,
  apiAntrianGet,
  apiAntrianGetNoMessage,
} from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useDataAntrianStore = defineStore({
  id: "dataAntrian",
  state: () => ({}),
  getters: {},
  actions: {
    async getAntrianRJ(
      start_date: number,
      end_date: number,
      page?: number,
      limit?: number,
      totalData?: number,
      q?: string,
      status_antrian?: string,
      payload = {}
    ) {
      return apiAdmisiGet(
        `/rawat-jalan?start_date=${start_date}&end_date=${end_date}&page=${page}&limit=${limit}&total_data=${totalData}&q=${q}&status_antrian=${status_antrian}`,
        payload
      );
    },
    async getAntrianAdmisi(
      start_date?: number,
      end_date?: number,
      page?: number,
      page_size?: number,
      total?: number,
      name?: string,
      status_panggilan?: string,
      pelayanan?: string,
      payload = {}
    ) {
      const params = new URLSearchParams();
      if (start_date !== undefined)
        params.set("start_date", String(start_date));
      if (end_date !== undefined) params.set("end_date", String(end_date));
      if (page !== undefined) params.set("page", String(page));
      if (page_size !== undefined) params.set("page_size", String(page_size));
      if (total !== undefined) params.set("total", String(total));
      if (name) params.set("name", name);
      if (status_panggilan) params.set("status_panggilan", status_panggilan);
      if (pelayanan) params.set("pelayanan", pelayanan);

      const query = params.toString();
      const url = query
        ? `/admisi-antrian?${query}`
        : `/admisi-antrian`;

      return apiAntrianGetNoMessage(url, payload);
    },
  },
});
