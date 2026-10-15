import { defineStore } from "pinia";
import {
  apiAdmisiGet,
  apiAdmisiPost,
  apiAdmisiPut,
  apiAdmisiDelete,
} from "@/utils/apiHandler";

export const useAdmisiIGDStore = defineStore({
  id: "admisiIGD",
  state: () => ({}),
  getters: {},
  actions: {
    async getIGD(
      {
        q = "",
        paymentMethod = "",
        page = 1,
        limit = 10,
        startDate = "",
        endDate = "",
        dpjp = "",
        withoutIdentity = "",
        status= ""
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/igd?q=${q}&payment_method=${paymentMethod}&page=${page}&limit=${limit}&start_date=${startDate}&end_date=${endDate}&dpjp=${dpjp}&without_identity=${withoutIdentity}&status=${status}`,
        payload
      );
      return {
        message: "Data IGD berhasil ditampilkan",
        payload: [
          {
            uuid: "01928949-5c0d-7449-b327-cfadb4859ee9",
            noReg: "REG2410140003",
            noRm: "00-00-03",
            tanggalDaftar: 1728880139,
            tanggalDirawat: 1728880139,
            withoutIdentity: false,
            newborn: false,
            patient: {
              uuid: "01928949-5c05-7557-905f-2d2369eb7ec6",
              title: "Mr.",
              name: "John Doe",
              identity: "KTP",
              noIdentity: "A114563s8",
              phone: "+621234567890",
              gender: "Male",
              address: {
                prov: "Jawa Timur",
                city: "Jakarta Selatan",
                district: "Pancoran",
                rt: "01",
                rw: "02",
                fullAddress: "Jl. Raya No. 123",
                country: "Indonesia",
                village: "Kampung",
              },
            },
            birthDetail: {
              ageYear: 34,
              ageMonth: 9,
              ageDay: 13,
            },
            practitioner: {
              title: "Ir",
              nama: "Rudi tabuti",
              gender: "L",
            },
          },
        ],
        properties: {
          page: 1,
          pageSize: 10,
          totalPage: 1,
          totalData: 1,
          nextPage: null,
          prevPage: null,
        },
      };
    },
    async registIGD(payload = {}) {
      return apiAdmisiPost("/igd", payload);
    },
    async updateIGD(uuid: string = "", payload = {}) {
      return apiAdmisiPut(`/igd/${uuid}`, payload);
    },
    async getDetailIGD(uuid: string = "", payload = {}) {
      return apiAdmisiGet(`/igd/${uuid}`, payload);
    },
    async cancelVisitIGD(payload = {}) {
      return apiAdmisiDelete("/igd/cancel", payload);
    },
  },
});
