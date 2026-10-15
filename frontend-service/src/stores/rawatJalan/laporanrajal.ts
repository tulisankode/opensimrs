import { defineStore } from "pinia";
import {
    apiRawatJalanGet,
    apiRawatJalanPut
} from "@/utils/apiHandler";
import { ref } from "vue";

export const useRJStore = defineStore({
    id: "PelayananRJ",
    state: () => ({
        antrianList: ref<any[]>([]), // Tambahkan state untuk antrian
    }),
    getters: {},
    actions: {
        async getKunjunganRajal(
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
            return apiRawatJalanGet(
                `/report/kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
                payload
            );
        },
        async getBatalPoli(
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
            return apiRawatJalanGet(
                `/report/batal-kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&polyclinic=${polyclinic}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
                payload
            );
        },
        async DownloadKunjunganRajal(
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
            return apiRawatJalanGet(
                `/report/kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&polyclinic=${polyclinic}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&all=aktif`,
                payload
            );
        },
        async DownloadBatalPoli(
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
            return apiRawatJalanGet(
                `/report/batal-kunjungan?q=${q}&page=${page}&limit=${limit}&room=${room}&practitioner_uuid=${practitionerUuid}&polyclinic=${polyclinic}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&all=aktif`,
                payload
            );
        },
        async getAllAntrianCall() {
            const responseData = await apiRawatJalanGet("/antrian-call", {});
            if (responseData && responseData.payload) {
                this.antrianList = responseData.payload;
                return responseData.payload;
            }
            return [];
        },
        // Petugas yang login: praktisi, dokter atau bukan, dan poli tugasnya (untuk filter "antrian saya").
        async getKonteksPetugas() {
            const res = await apiRawatJalanGet("/antrian-call/konteks", {});
            return res?.payload ?? { practitionerUuid: null, isDoctor: false, nama: null, poli: [] };
        },
        // RME dibuka: panggilan poli diproses & kunjungan menjadi Diperiksa (bila masih antri).
        async mulaiPeriksa(rawatJalanUuid: string) {
            return apiRawatJalanPut(`/antrian-call/kunjungan/${rawatJalanUuid}/periksa`, {});
        },
        async updateAntrianCall(uuid: string, newStatus: number) {
            const payload = {
                statusPanggilan: newStatus,
            };
            const responseData = await apiRawatJalanPut(`/antrian-call/${uuid}`, payload);
            await this.getAllAntrianCall();
            return responseData;
        },
    },
});