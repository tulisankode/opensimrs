import { apiInventoryGet, apiInventoryPost, apiInventoryPut } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useStorageLocationStore = defineStore({
    id: "StorageLocation",
    state: () => ({}),
    getters: {},
    actions: {
        async getApi(
            page: number = 1,type: string = "gudang", limit: number = 10, payload = {}
        ) {
            return apiInventoryGet(
                `/inventory/datamaster/lokasi-gudang?page=${page}&type=${type}&limit=${limit}`,
                payload
            );
        },
        async getApiDepo(
            page: number = 1,type: string = "depo", limit: number = 10, payload = {}
        ) {
            return apiInventoryGet(
                `/inventory/datamaster/lokasi-gudang?page=${page}&type=${type}&limit=${limit}`,
                payload
            );
        },
    },
});
