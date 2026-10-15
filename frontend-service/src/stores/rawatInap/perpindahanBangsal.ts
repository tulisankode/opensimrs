import { defineStore } from "pinia";

import { apiRawatInapGet, apiRawatInapPost, apiRawatInapPut } from "@/utils/apiHandler";

export const usePerpindahanBangsalStore = defineStore({
    id: "perpindahanBangsal",
    state: () => ({}),
    getters: {},
    actions: {
        async getAll({ q = "", dpjp = "", paymentMethod = "", page = 1, limit = 10 }, payload = {}) {
            return apiRawatInapGet(`/transfer-bed/all?q=${q}&page=${page}&limit=${limit}&dpjp=${dpjp}&payment_method=${paymentMethod}`, payload);
        },
        async getHistoryPerpindahanBangsal(uuid: string, payload = {}) {
            return apiRawatInapGet(`/transfer-bed/history/${uuid}`, payload);
        },
        async getDetailRequest(uuid: string, payload = {}) {
            return apiRawatInapGet(`/transfer-bed/request/detail/${uuid}`, payload);
        },
        async approveRequestMoveBed(uuid: string, payload = {}) {
            return apiRawatInapPut(`/transfer-bed/approve/${uuid}`, payload);
        },
        async getTotalPending(payload = {}) {
            return apiRawatInapGet(`/transfer-bed/total-pending`, payload);
        },
        async rejectRequestMoveBed(uuid: string, payload = {}) {
            return apiRawatInapPut(`/transfer-bed/reject/${uuid}`, payload);
        },
        async requestMoveBed(uuid: string, payload = {}) {
            return apiRawatInapPost(`/transfer-bed/request/${uuid}`, payload);
        },
        async getCurrentBed(uuid: string, payload = {}) {
            return apiRawatInapGet(`/transfer-bed/current-bed/${uuid}`, payload);
        }

    },
});
