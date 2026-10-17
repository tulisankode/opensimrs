import { defineStore } from "pinia";
import {
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
} from "@/utils/apiHandler";

export const useRujukanLabStore = defineStore({
  id: "rujukan-lab",
  state: () => ({}),
  getters: {},
  actions: {
    async tandaiApi(observationItemUuid: string, payload = {}) {
      return apiLaboratoriumPut(
        `/lab/observation-item/${observationItemUuid}/tandai-rujukan`,
        payload
      );
    },
    async batalApi(observationItemUuid: string, payload = {}) {
      return apiLaboratoriumPut(
        `/lab/observation-item/${observationItemUuid}/batal-rujukan`,
        payload
      );
    },
    async kirimApi(observationItemUuid: string, payload = {}) {
      return apiLaboratoriumPut(
        `/lab/observation-item/${observationItemUuid}/kirim-rujukan`,
        payload
      );
    },
    async unggahBerkasApi(observationItemUuid: string, formData: FormData) {
      return apiLaboratoriumPost(
        `/lab/observation-item/${observationItemUuid}/berkas-rujukan`,
        formData
      );
    },
    async unduhBerkasApi(observationItemUuid: string, payload = {}) {
      return apiLaboratoriumGet(
        `/lab/observation-item/${observationItemUuid}/berkas-rujukan`,
        payload
      );
    },
    async hapusBerkasApi(observationItemUuid: string, payload = {}) {
      return apiLaboratoriumDelete(
        `/lab/observation-item/${observationItemUuid}/berkas-rujukan`,
        payload
      );
    },
  },
});
