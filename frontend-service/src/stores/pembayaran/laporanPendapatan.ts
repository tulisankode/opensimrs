import { defineStore } from "pinia";
import { apiPembayaranGet } from "@/utils/apiHandler";

export const useReportLaporanPendapatanStore = defineStore({
    id: "lapoaranpendapatan",
    state: () => ({}),
    getters: {},
    actions: {
        async getApi(
            startDate: number = 0,
            endDate: number = 0,
            payload = {}
        ) {
            return apiPembayaranGet(
                `/payment/report/revenue?&start_date=${startDate}&end_date=${endDate}`,
                payload
            );
        },
        async exportApi(
            startDate: number = 0,
            endDate: number = 0
        ) {
            const config = {
                responseType: 'blob',
            };
            
            return apiPembayaranGet(
                `/payment/report/revenue/export?start_date=${startDate}&end_date=${endDate}`,
                config 
            );
        },
    },
});
