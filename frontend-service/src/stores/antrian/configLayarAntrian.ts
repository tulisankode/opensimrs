import {
  apiAdmisiGet,
  apiAntrianDelete,
  apiAntrianGet,
  apiAntrianGetNoMessage,
  apiAntrianPost,
  apiAntrianPut,
  apiRawatJalanGet,
} from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useConfigLayarAntrianStore = defineStore({
  id: "configLayarAntrian",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      page_size: number = 10,
      nama_layar?: string,
      tipe_layar?: number,
      aktif?: boolean,
      payload = {}
    ) {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: page_size.toString(),
      });

      if (nama_layar !== undefined && nama_layar !== "") {
        params.append("nama_layar", nama_layar);
      }
      if (tipe_layar !== undefined) {
        params.append("tipe_layar", tipe_layar.toString());
      }
      if (aktif !== undefined) {
        params.append("aktif", aktif ? "true" : "false");
      }

      return apiAntrianGetNoMessage(
        `/layar-antrian?${params.toString()}`,
        payload
      );
    },
    async getApiLayarPoli(statusPanggilan = "", payload = {}) {
      return apiRawatJalanGet(
        `/antrian-call?status_panggilan=${statusPanggilan}`,
        payload
      );
    },
    async deleteLayarAntrian(layarAntrianUuid: string) {
      return apiAntrianDelete(`/layar-antrian/${layarAntrianUuid}`, {});
    },
    async createLayarAntrian(payload: {}) {
      return apiAntrianPost(`/layar-antrian`, payload);
    },
    async updateLayarAntrian(uuid: string, payload: {}) {
      return apiAntrianPut(`/layar-antrian/${uuid}`, payload);
    },
    // Link mode kiosk (layar TV tanpa login)
    async getKunciKiosk(uuid: string) {
      return apiAntrianGetNoMessage(`/layar-antrian/${uuid}/kiosk`, {});
    },
    async buatUlangKunciKiosk(uuid: string) {
      return apiAntrianPost(`/layar-antrian/${uuid}/kiosk`, {});
    },
    async getAntrianCall(statusPanggilan: number, payload = {}) {
      return apiAdmisiGet(
        `/antrian-call?status_panggilan=${statusPanggilan}`,
        payload
      );
    },
  },
});
