import { defineStore } from "pinia";
import { apiPembayaranGet, apiPembayaranPost } from "@/utils/apiHandler";

export const useReportCloseBillStore = defineStore({
    id: "closebill",
    state: () => ({}),
    getters: {},
    actions: {
        async getApi(
            page: number = 1,
            limit: number = 10,
            startDate: number = 0,
            endDate: number = 0,
            search: string = "",
            status: string = "SEMUA",
            service_type: string | string[] = "", 
            payment_type: string | string[] = ""
        ) {
            const params = {
                page,
                limit,
                start_date: startDate,
                end_date: endDate,
                search,
                status: status.toUpperCase() === 'SEMUA' ? '' : status.toUpperCase(),
                service_type,
                payment_type,
            };

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
            
            return apiPembayaranGet(`/payment/closed-bills?${queryString}`, {});
        },
        async getDetailBill(uuid: string, payload = {}) {
            return apiPembayaranGet(`/payment/${uuid}`, payload);
        },
        async getDetailPasienBill(uuid: string, payload = {}) {
            return apiPembayaranGet(`/payment/${uuid}/pasien`, payload);
        },
        async getPaymentHistory(uuid: string, payload = {}) {
            return apiPembayaranGet(`/payment/closed-bills/${uuid}/history`, payload);
        },
        async getClosedBillList(payload = {}) {
            return apiPembayaranGet('/payment/closed-bills', payload);
        },
        async payDebtOnClosedBill(uuid: string, payload = {}) {
            return apiPembayaranPost(`/payment/closed-bills/${uuid}/pay`, payload);
        },
        async exportApi(payload = {}) {
            return apiPembayaranGet(``, payload);
        },
    },
});
