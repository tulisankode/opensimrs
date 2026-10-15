import { defineStore } from "pinia";
import {
  apiAntrianGet,
  apiAntrianDelete,
  apiAntrianPost,
  apiAntrianPut,
  apiAntrianGetNoMessage,
  apiDatamasterGet,
} from "@/utils/apiHandler";

interface JadwalItem {
  jadwalDokterUuid?: string;
  day?: number;
  startTime?: string;
  endTime?: string;
  kuotaJkn?: number;
  kuotaNonJkn?: number;
  durasiPelayanan?: number;
  aktif?: boolean;
}

interface JadwalPayload {
  deleted: string[];
  updated: JadwalItem[];
  added: JadwalItem[];
}

export const useJadwalDokterStore = defineStore({
  id: "jadwalDokter",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(
      page: number = 1,
      page_size: number = 10,
      aktif?: boolean,
      poli_uuid?: string,
      doctor_uuid?: string,

      payload = {}
    ) {
      const statusQuery = aktif === undefined ? "" : `&aktif=${aktif}`;
      const poliQuery =
        poli_uuid === undefined ? "" : `&poli_uuid=${poli_uuid}`;
      const doctorQuery =
        doctor_uuid === undefined ? "" : `&doctor_uuid=${doctor_uuid}`;
      return apiAntrianGetNoMessage(
        `/jadwal-dokter?page=${page}&page_size=${page_size}${statusQuery}${poliQuery}${doctorQuery}`,
        payload
      );
    },
    async deleteDoctor(doctorUuid: string, poliUuid: string) {
      return apiAntrianDelete(
        `/jadwal-dokter/${doctorUuid}/${poliUuid}`,
        {}
      );
    },
    async addJadwalDoctor(payload: {
      dokter_uuid: string;
      poliklinik_uuid: string;
      jadwal: Array<{
        day: number;
        startTime: string;
        endTime: string;
        kuotaJkn: number;
        kuotaNonJkn: number;
        durasiPelayanan: number;
        aktif: boolean;
      }>;
    }) {
      return apiAntrianPost(`/jadwal-dokter`, payload);
    },
    async updateJadwalDoctor(
      doctorUuid: string,
      poliUuid: string,
      payload: JadwalPayload
    ) {
      return apiAntrianPut(
        `/jadwal-dokter/${doctorUuid}/${poliUuid}`,
        payload
      );
    },
    async getApiPoli(name: string, payload = {}) {
      return apiDatamasterGet(
        `/datamaster/lokasi/poli/aktif?name=${name}`,
        payload
      );
    },
    async getApiListDokter(poliUuid: string, name: string, payload = {}) {
      return apiDatamasterGet(
        `/datamaster/practitioner/poli/aktif?poli_uuid=${poliUuid}&name=${name}`,
        payload
      );
    },
  },
});
