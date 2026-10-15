import { apiInventoryGet } from "@/utils/apiHandler";
import { defineStore } from "pinia";

export const useExpiredDrugReportStore = defineStore({
    id: "ExpiredDrugReport",
    state: () => ({}),
    getters: {},
    actions: {
        async getApi(
            lokasiStok: String = "",
            tanggalMulai: string = "",
            tanggalSelesai: string = "",
            search: string = "",
            page: number = 1,
            limit: number = 10,
            payload = {}
        ) {
            return apiInventoryGet(
                `/inventory/laporan/barang-expired?lokasi_stok_uuid=${lokasiStok}&tanggal_mulai=${tanggalMulai}&tanggal_selesai=${tanggalSelesai}&search=${search}&page=${page}&limit=${limit}`, payload);
        },
    },
});
