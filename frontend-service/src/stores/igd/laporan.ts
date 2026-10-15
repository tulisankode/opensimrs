import { defineStore } from "pinia";
import { apiIgdGet } from "@/utils/apiHandler";


export const useIgdLaporanStore = defineStore({
  id: "igdReport",
  state: () => ({}),
  getters: {},
  actions: {
    async getKunjunganIGD(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiIgdGet(
                `/report/kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
                payload
            );
        },
    async getBatalIGD(
        {
            q = "",
            page = 1,
            limit = 10,
            room = "",
            polyclinic = "",
            practitionerUuid = "",
            jenisKunjungan = "",
            startDate = "",
            endDate = "",
        },
        payload = {}
      ) {
          return apiIgdGet(
            `/report/batal-kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&polyclinic=${polyclinic}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
            payload
        );
     },
     async downloadKunjunganIGD(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiIgdGet(
                `/report/kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&all=aktif`,
                payload
            );
        },
        async downloadBatalKunjunganIGD(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiIgdGet(
                `/report/batal-kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&all=aktif`,
                payload
            );
        },
  },
});
