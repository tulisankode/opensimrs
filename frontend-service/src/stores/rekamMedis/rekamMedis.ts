import { defineStore } from "pinia";
import {
  apiRekamMedisGet,
  apiRekamMedisPost,
  apiRekamMedisPut,
  apiRekamMedisDelete,
  apiRekamMedisDownload,
  apiFarmasiGet,
  apiFarmasiPatch,
  apiRawatInapGet,
  apiRawatInapPost,
} from "@/utils/apiHandler";
import { dateToEpoch } from "@/utils/Helpers";

export const useRekamMedisStore = defineStore({
  id: "rekamMedis",
  state: () => ({
    openedRekamMedis: {} as any,
  }),
  getters: {},
  actions: {
    setOpenedRekamMedisData(rmData: any) {
      this.openedRekamMedis = rmData;
    },
    resetOpenedRekamMedisData() {
      this.openedRekamMedis = {};
    },
    setAsesmentSummaryRekamMedisData(asesmenSummary: any) {
      this.openedRekamMedis.data = asesmenSummary.data;
      this.openedRekamMedis.summary = asesmenSummary.summary;
    },
    setAsesmentRekamMedisData(asesmen: any) {
      if (asesmen.data) {
        this.openedRekamMedis.data = asesmen.data;
      } else {
        this.openedRekamMedis.data = asesmen;
      }
    },

    async createRekamMedis(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/patient", payload);
    },
    async getRekamMedis(
      params: {
        dateOrder?: number;
        sessionOrder?: number;
        rekamMedisUuid: string;
      },
      payload = {}
    ) {
      return apiRekamMedisGet(
        `/rekam-medis/patient?${
          params.dateOrder ? "date_order=" + params.dateOrder : ""
        }${
          params.sessionOrder ? "&session_order=" + params.sessionOrder : ""
        }&rekam_medis_uuid=${params.rekamMedisUuid}`,
        payload
      );
    },

    async createNewRecord(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/record", payload);
    },
    async createNewSession(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/session", payload);
    },
    async deleteSession(payload = {}) {
      return apiRekamMedisDelete("/rekam-medis/session", payload);
    },

    async insertAssesment(payload = {}, opsi: { diam?: boolean } = {}) {
      return apiRekamMedisPost("/rekam-medis/assessment", payload, opsi);
    },
    async insertTindakan(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/tindakan", payload);
    },

    async getInstruksi(sessionUuid: string, payload = {}) {
      return apiRekamMedisGet(
        `/rekam-medis/chat/instruksi?session_uuid=${sessionUuid}`,
        payload
      );
    },
    async insertInstruksi(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/chat/instruksi", payload);
    },
    async insertInstruksiMedis(payload = {}) {
      return apiRekamMedisPut("/rekam-medis/chat/instruksi", payload);
    },

    async getCatatan(sessionUuid: string, payload = {}) {
      return apiRekamMedisGet(
        `/rekam-medis/chat/catatan?session_uuid=${sessionUuid}`,
        payload
      );
    },
    async insertCatatan(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/chat/catatan", payload);
    },
    async insertCatatanPerawat(payload = {}) {
      return apiRekamMedisPut("/rekam-medis/chat/catatan", payload);
    },
    async pushOrderObat(payload: {
      sessionUuid: string;
      orderObatUuid: string;
    }) {
      return apiRekamMedisPost("/rekam-medis/order-obat", payload);
    },
    async addFPO(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/fpo", payload);
    },
    async getAllFPO({ date = "", rekamMedisUuid = "" }, payload = {}) {
      let epochDate: string | number = "";
      
      if (date) {
        if (date as any) {
           epochDate = dateToEpoch(date as any);
        }
        else if (typeof date === 'string') {
            const parts = date.split("-");
            let dateObject;
            if (parts[0].length === 2 && parts[2].length === 4) {
                dateObject = new Date(
                  parseInt(parts[2], 10),
                  parseInt(parts[1], 10) - 1,
                  parseInt(parts[0], 10) 
                );
            } 
            else if (parts[0].length === 4) {
                 dateObject = new Date(
                  parseInt(parts[0], 10),      
                  parseInt(parts[1], 10) - 1,
                  parseInt(parts[2], 10)
                );
            }
            if (dateObject && !isNaN(dateObject.getTime())) {
                epochDate = dateToEpoch(dateObject);
            }
        }
      }
      return apiFarmasiGet(
        `/farmasi/prescriptions/fpo?date=${epochDate}&rekam_medis_uuid=${rekamMedisUuid}`,
        payload
      );
    },
    async updatesisaobat(prescriptionItemUuid: string, payload = {}) {
      return apiFarmasiPatch(
        `/farmasi/prescriptions/${prescriptionItemUuid}`,
        payload
      );
    },
    async getFPODetail({ prescriptionItemUuid = "", date = "" }, payload = {}) {
      return apiRekamMedisGet(
        `/rekam-medis/fpo?prescription_item_uuid=${prescriptionItemUuid}&date=${date}`,
        payload
      );
    },
    async editFPO(payload = {}) {
      return apiRekamMedisPut("/rekam-medis/fpo", payload);
    },
    async getAllInformConsent({ rekamMedisUuid = "" }, payload = {}) {
      return apiRekamMedisGet(
        `/rekam-medis/inform-consent?rekam_medis_uuid=${rekamMedisUuid}`,
        payload
      );
    },
    async postInformConsent(payload = {}) {
      return apiRekamMedisPost("/rekam-medis/inform-consent", payload);
    },
    async deleteInformConsent({ uuid = "" }) {
      return apiRekamMedisDelete(
        `/rekam-medis/inform-consent/${uuid}`,
        {}
      );
    },
    async getHistoryAssesment(
      { noPelayanan = "", noRm = "", key = "", page = 1, limit = 10 },
      payload = {}
    ) {
      return apiRekamMedisGet(
        `/rekam-medis/inform-consent?no_pelayanan=${noPelayanan}&no_rm=${noRm}&key=${key}&page=${page}&limit=${limit}`,
        payload
      );
    },

    async getCompare({ noPelayanan = "", noRm = "", jenisKunjungan = "", key = "", dateFilter = "", sessionOrder = "" },
      payload = {}
    ) {
      return apiRekamMedisGet (
        `/rekam-medis/item-before?no_pelayanan=${noPelayanan}&no_rm=${noRm}&jenis_kunjungan=${jenisKunjungan}&key=${key}&date_filter=${dateFilter}&session_order=${sessionOrder}`,
        payload
      )
    },
    async getBerkas ({ rekamMedisUuid = "" }, payload = {})
    {
      return apiRekamMedisGet(`/rekam-medis/pelayanan/files?rekam_medis_uuid=${rekamMedisUuid}`, payload);
    },
    async getSurat ({ rekamMedisUuid = "" }, payload = {})
    {
      return apiRekamMedisGet(`/rekam-medis/pelayanan/files/letters?rekam_medis_uuid=${rekamMedisUuid}`, payload);
    },
    async createFiles (payload = {})
    {
      return apiRekamMedisPost("/rekam-medis/pelayanan/files", payload);
    },
    async deleteFiles (payload = {})
    {
      return apiRekamMedisDelete("/rekam-medis/pelayanan/files", payload);
    },
    async updateFiles (payload = {})
    {
      return apiRekamMedisPut("/rekam-medis/pelayanan/files", payload);
    },
    async GenerateNS ({ type = "" }, payload = {})
    {
      return apiRekamMedisGet(`/rekam-medis/pelayanan/files/generate-code?type=${type}`, payload);
    },
    async downloadSurat({ uuid = "" }, payload = {}) {
      return apiRekamMedisDownload(
        `/rekam-medis/pelayanan/files/letter/download?uuid=${uuid}`
      );
    },
    async createPerpindahan( uuidRawatInap: string, payload = {}) {
      return apiRawatInapPost(`/transfer-bed/request/${uuidRawatInap}`, payload);
    },
    async getPerpindahanHistory(uuidRawatInap: string, payload = {}) {
      return apiRawatInapGet(`/transfer-bed/history/${uuidRawatInap}`, payload);
    },
  },
});