import { defineStore } from "pinia";
import { apiSettingGet, apiSettingPut } from "@/utils/apiHandler";

export const useSettingStore = defineStore({
    id: "setting",
    state: () => ({
    }),
    getters: {},
    actions: {
        getProfilAkunApi(payload = {}) {
            return apiSettingGet("profile", payload);
        },
        putProfilAkunApi(payload = {}) {
            return apiSettingPut("profile", payload);
        },

        // Profil Faskes
        getProfilFaskesApi(payload = {}) {
            return apiSettingGet("profil-faskes", payload);
        },
        putProfilFaskesApi(payload = {}) {
            return apiSettingPut("profil-faskes", payload);
        },

        // Print Out
        getPrintOutApi(payload = {}) {
            return apiSettingGet("printer",payload)
        },
        putPrintOutApi(payload = {}) {
            return apiSettingPut("printer", payload);
        },

        // KonfigurasiIntegrasi 
        getKonfigurasiIntegrasiApi(payload = {}) {
            return apiSettingGet("integrasi", payload);
        },

        putKonfigurasiVCLAIM(payload = {}) {
            return apiSettingPut("integrasi-vclaim", payload)
        },
        putKonfigurasiLainnya(payload = {}) {
            return apiSettingPut("integrasi-other", payload)
        },
        putKonfigurasiSatuSehat(payload = {}) {
            return apiSettingPut("integrasi-satu-sehat", payload)
        },

        // System

        getBiayaAdministrasi(payload = {}) {
            return apiSettingGet("biaya-administrasi", payload)
        },
        putBiayaAdministrasi(payload = {}) {
            return apiSettingPut("biaya-administrasi", payload)
        },

        getPPN(payload = {}) {
            return apiSettingGet("ppn",payload)
        },
        putPPN(payload = {}) {
            return apiSettingPut("ppn", payload)
        }
    },
});
