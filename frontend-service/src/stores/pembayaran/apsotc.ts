import { defineStore } from "pinia";
import { apiPembayaranGet,apiPembayaranPost } from "@/utils/apiHandler";

export const useApsOtcTransaction = defineStore({
    id: "apsotc",
    state: () => ({}),
    getters: {},
    actions: {
        async getApi(
            page: number = 1,
            limit: number = 10,
            startDate: number = 0,
            endDate: number = 0,
            search: string = "",
            status: string = "",
            service_type: string | string[] = "", 
            payment_method: string | string[] = ""
        ) {
            const params = {
                page,
                limit,
                start_date: startDate,
                end_date: endDate,
                search,
                status,
                service_type,
                payment_method,
            };

            // Query builder ini bisa handle array untuk service_type
            const queryString = Object.entries(params)
            .flatMap(([key, value]) => {
                if (Array.isArray(value)) {
                    return value.map(item => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
                }
                if (value !== '' && value !== null && value !== undefined) {
                    return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
                }
                return [];
            })
            .join('&');
            
            return apiPembayaranGet(`/payment/aps-otc?${queryString}`, {});
        },

        async getApsOtcList(payload = {}) {
            return apiPembayaranGet(`/payment/aps-otc`, payload);
        },
        async getItemBill(uuid: string, payload = {}) {
            return apiPembayaranGet(`/payment/${uuid}/items`, payload);
        },
        async postPayment(uuid: string, payload = {}) {
            return apiPembayaranPost(`/payment/${uuid}/payment`, payload);
        },
        async getDetailBill(uuid: string, payload = {}) {
            return apiPembayaranGet(`/payment/${uuid}`, payload);
        },
        async exportApi(payload = {}) {
            return apiPembayaranGet(`/aps-otc/export`, payload);
        },
    },
});