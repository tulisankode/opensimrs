import { defineStore } from "pinia";
import {
  apiRekamMedisGet,
  apiRekamMedisPost,
  apiRekamMedisPut,
  apiRekamMedisDelete,
} from "@/utils/apiHandler";

export const useRekamMedisPelayananStore = defineStore({
  id: "rekamMedisPelayanan",
  state: () => ({}),
  actions: {
    async getHistory(noRm = "", payload = {}) {
      return apiRekamMedisGet(`/rekam-medis/pelayanan/history?no_rm=${noRm}`, payload);
    },
    async getResumeMedis(
      params: { rekamMedisUuid: string; pelayanan: string },
      payload = {}
    ) {
      return apiRekamMedisGet(
        `/rekam-medis/pelayanan/resume?rekam_medis_uuid=${params.rekamMedisUuid}&pelayanan=${params.pelayanan}`,
        payload
      );
    },
    async putResumeMedis(payload = {}) {
      return apiRekamMedisPut("/rekam-medis/pelayanan/resume", payload);
    },

    async getAllFiles(rekamMedisUuid = "", payload = {}) {
      return apiRekamMedisGet(
        `/rekam-medis/pelayanan/files?rekam_medis_uuid=${rekamMedisUuid}`,
        payload
      );
    },
    async uploadFile(payload: {
      rekamMedisUuid: string;
      file: string;
      fileType:
        | "surat_kontrol_rawat_jalan"
        | "surat_permohonan_rawat_inap"
        | "surat_keterangan_sakit"
        | "surat_keterangan_sehat"
        | "surat_rujuk_keluar_faskes"
        | "surat_keterangan_meninggal"
        | "resep_kacamata"
        | "berkas";
      fileFormat: string;
      namaFile: string;
      admissionType: string;
    }) {
      return apiRekamMedisPost(`/rekam-medis/pelayanan/files`, payload);
    },
    async updateFile(payload: { file: string; fileUuid: string }) {
      return apiRekamMedisPut(`/rekam-medis/pelayanan/files`, payload);
    },
    async deleteFile(rekamMedisUuid = "", payload: { fileUuid: string }) {
      return apiRekamMedisDelete(
        `/rekam-medis/pelayanan/files?rekam_medis_uuid=${rekamMedisUuid}`,
        payload
      );
    },
    async discharge(payload: {
      pelayanan: "ri" | "rj" | "igd" | "fisio";
      rekamMedisUuid: string;
      lokasiUuid: string;
    }) {
      return apiRekamMedisPut(`/rekam-medis/pelayanan/discharge`, payload);
    },
  },
});
