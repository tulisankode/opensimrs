import { defineStore } from "pinia";
import {
    apiRawatInapGet
} from "@/utils/apiHandler";

export const useRIStore = defineStore({
    id: "PelayananRI",
    state: () => ({}),
    getters: {},
    actions: {
        async getKunjunganRanap(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                kelas = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiRawatInapGet(
                `/report/kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&kelas=${kelas}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
                payload
            );
        },
        async getBatalRawat(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                kelas = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiRawatInapGet(
                `/report/batal-kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&kelas=${kelas}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
                payload
            );
        },
        async getPerpindahan(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                kelas = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiRawatInapGet(
                `/report/perpindahan?q=${q}&page=${page}&limit=${limit}&room=${room}&kelas=${kelas}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
                payload
            );
        },
         async DownloadPerpindahan(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                kelas = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiRawatInapGet(
                `/report/perpindahan?q=${q}&page=${page}&limit=${limit}&room=${room}&kelas=${kelas}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&all=aktif`,
                payload
            );
        },
         async DownloadKunjunganRanap(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                kelas = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiRawatInapGet(
                `/report/kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&kelas=${kelas}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&all=aktif`,
                payload
            );
        },
         async DownloadBatalRawat(
            {
                q = "",
                page = 1,
                limit = 10,
                room = "",
                kelas = "",
                practitionerUuid = "",
                jenisKunjungan = "",
                startDate = "",
                endDate = "",
            },
            payload = {}
        ) {
            return apiRawatInapGet(
                `/report/batal-kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&kelas=${kelas}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&all=aktif`,
                payload
            );
        },
    },
});