import { defineStore } from "pinia";
import { apiSettingGet, apiSettingPut, apiSettingPost } from "@/utils/apiHandler";

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
        },

        // Audit Trail (STD-0029)
        getAuditTrailApi(params: Record<string, unknown> = {}) {
            const query = new URLSearchParams(
                Object.entries(params).reduce((acc, [k, v]) => {
                    if (v !== undefined && v !== null && v !== "") acc[k] = String(v);
                    return acc;
                }, {} as Record<string, string>)
            ).toString();
            return apiSettingGet(`audit-trail${query ? `?${query}` : ""}`, {});
        },
        getAuditTrailDetailApi(uuid: string) {
            return apiSettingGet(`audit-trail/${uuid}`, {});
        },
        getRiwayatAuditPasienApi(patientUuid: string, params: Record<string, unknown> = {}) {
            const query = new URLSearchParams(
                Object.entries(params).reduce((acc, [k, v]) => {
                    if (v !== undefined && v !== null && v !== "") acc[k] = String(v);
                    return acc;
                }, {} as Record<string, string>)
            ).toString();
            return apiSettingGet(`audit-trail/pasien/${patientUuid}${query ? `?${query}` : ""}`, {});
        },
        eksporAuditTrailApi(payload: Record<string, unknown> = {}) {
            return apiSettingPost("audit-trail/ekspor", payload);
        },
        verifikasiAuditTrailApi(payload: Record<string, unknown> = {}) {
            return apiSettingPost("audit-trail/verifikasi", payload);
        },
    },
});
