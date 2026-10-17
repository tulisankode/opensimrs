import { defineStore } from "pinia";

import { apiRawatInapGet, apiRawatInapPost } from "@/utils/apiHandler";

export const useIcuStore = defineStore({
    id: "icu",
    state: () => ({}),
    getters: {},
    actions: {
        async getDashboard(payload = {}) {
            return apiRawatInapGet(`/icu/dashboard`, payload);
        },
        async getPerawatan(perawatanUuid: string, payload = {}) {
            return apiRawatInapGet(`/icu/perawatan/${perawatanUuid}`, payload);
        },
        async mulaiPerawatan(perpindahanUuid: string, data: object) {
            return apiRawatInapPost(`/icu/perpindahan/${perpindahanUuid}/mulai`, data);
        },
        async keluarPerawatan(perawatanUuid: string, data: object) {
            return apiRawatInapPost(`/icu/perawatan/${perawatanUuid}/keluar`, data);
        },
        async tambahObservasi(perawatanUuid: string, data: object) {
            return apiRawatInapPost(`/icu/perawatan/${perawatanUuid}/observasi`, data);
        },
        async getObservasi(perawatanUuid: string, dari?: number, sampai?: number) {
            const q = new URLSearchParams();
            if (dari) q.set("dari", String(dari));
            if (sampai) q.set("sampai", String(sampai));
            return apiRawatInapGet(`/icu/perawatan/${perawatanUuid}/observasi?${q.toString()}`, {});
        },
        async koreksiObservasi(observasiUuid: string, data: object) {
            return apiRawatInapPost(`/icu/observasi/${observasiUuid}/koreksi`, data);
        },
        async tambahIntakeOutput(perawatanUuid: string, data: object) {
            return apiRawatInapPost(`/icu/perawatan/${perawatanUuid}/intake-output`, data);
        },
        async getBalance(perawatanUuid: string, dari: number, sampai: number) {
            return apiRawatInapGet(`/icu/perawatan/${perawatanUuid}/balance?dari=${dari}&sampai=${sampai}`, {});
        },
        async tambahSkorSofa(perawatanUuid: string, data: object) {
            return apiRawatInapPost(`/icu/perawatan/${perawatanUuid}/skor-sofa`, data);
        },
        async getSkorSofa(perawatanUuid: string, payload = {}) {
            return apiRawatInapGet(`/icu/perawatan/${perawatanUuid}/skor-sofa`, payload);
        },
        async getLaporan(dari: number, sampai: number, ruanganUuid?: string) {
            const q = new URLSearchParams({ dari: String(dari), sampai: String(sampai) });
            if (ruanganUuid) q.set("ruangan_uuid", ruanganUuid);
            return apiRawatInapGet(`/icu/laporan?${q.toString()}`, {});
        },
    },
});
