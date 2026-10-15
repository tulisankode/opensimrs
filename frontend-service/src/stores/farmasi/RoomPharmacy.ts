import { bolehLihatAlkesRm } from "@/utils/permissions";
import { defineStore } from "pinia";
import {
  apiFarmasiGet,
  apiFarmasiPost,
  apiFarmasiPut,
  apiFarmasiDelete,
} from "@/utils/apiHandler";
import { baseInstanceFarmasi } from "@/utils/Api";

export const useRoomPharmacyStore = defineStore({
  id: "RoomPharmacy",
  state: () => ({}),
  getters: {},
  actions: {
    async getApi(payload = {}) {
      return apiFarmasiPost("/farmasi/alkes/all", payload);
    },
    async detailApi(uuid: string, payload = {}) {
      return apiFarmasiGet(`/farmasi/alkes/${uuid}`, payload);
    },
    async createApi(payload = {}) {
      return apiFarmasiPost(`/farmasi/alkes`, payload);
    },
    async geInOneDate({ rekamMedisUuid = "", rekamMedisDate = "" }, payload = {}) {
      // pengguna tanpa izin alkes (mis. petugas lab membuka RM) tidak perlu disuguhi galat "Akses ditolak"
      if (!bolehLihatAlkesRm()) return { payload: [] };
      const url = `/farmasi/alkes/some-order?rekam_medis_uuid=${rekamMedisUuid}&rekam_medis_date=${rekamMedisDate}`;
      try {
        return await apiFarmasiGet(url, payload);

      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          console.warn("Data Order Alkes Kosong ");
          return { payload: [] }; 
        }
        throw error;
      }
    },
    async cancelOrderApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(`/farmasi/alkes/${uuid}`, payload);
    },
    async updateLocationApi(payload = {}) {
      return apiFarmasiPut("/farmasi/alkes/lokasi-stok", payload);
    },
    async updateAlkesApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/alkes/items/${uuid}/jenis-stok`, payload);
    },
    async updateAlkesItemApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/alkes/items/${uuid}`, payload);
    },
    async verifyApi(payload = {}) {
      return apiFarmasiPut("/farmasi/alkes/update-verifikasi", payload);
    },
    async verify2Api(payload = {}) {
      return apiFarmasiPut("/farmasi/alkes/siap-diserahkan", payload);
    },
    async verify3Api(payload = {}) {
      return apiFarmasiPut("/farmasi/alkes/diserahkan", payload);
    },
    async previousApi(payload = {}) {
      return apiFarmasiPut("/farmasi/alkes/batal-siap-diserahkan", payload);
    },
  },
});
