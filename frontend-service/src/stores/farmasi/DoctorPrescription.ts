import { defineStore } from "pinia";
import { apiFarmasiGet, apiFarmasiPost, apiFarmasiPostNoMessage, apiFarmasiPut, apiFarmasiDelete } from "@/utils/apiHandler";

export const useDoctorPrescriptionStore = defineStore({
  id: "DoctorPrescription",
  state: () => ({}),
  getters: {},
  actions: {
    async createPrescription(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/first-order", payload);
    },
    async addObatPrescription(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/add-obat", payload);
    },
    async getSomeOrderPrescription(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/some-order", payload);
    },
    async getApi(payload = {}) {
      return apiFarmasiPostNoMessage("/farmasi/prescriptions/all", payload);
    },
    async detailApi(uuid: string, payload = {}) {
      return apiFarmasiGet(`/farmasi/prescriptions/${uuid}`, payload);
    },
    async updatePrescription(uuid: string, payload: { isTakeaway?: boolean; lokasiStokUuid?: string }) {
      return apiFarmasiPut(`/farmasi/prescriptions/${uuid}`, payload);
    },
    async updatePrescriptionObat(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/prescriptions/obat/${uuid}`, payload);
    },
    async deleteObatApi(uuid: string, payload = {}) {
      return apiFarmasiDelete(`/farmasi/prescriptions/obat/${uuid}`, payload);
    },
    async updateObatApi(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/prescriptions/obat/${uuid}`, payload);
    },
    async updateStokObat(uuid: string, payload = {}) {
      return apiFarmasiPut(`/farmasi/prescriptions/obat/${uuid}/jenis-stok`, payload);
    },
    async statusVerifikasi(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/status-verifikasi", payload);
    },
    async statusSiapDiserahkan(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/status-siap-diserahkan", payload);
    },
    async statusDiserahkan(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/status-diserahkan", payload);
    },
    async lokasiStok(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/lokasi-stok", payload);
    },
    async updateTelaah(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/status-telaah", payload);
    },
    async batalOrder(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/batal-order", payload);
    },
    async batalSiapDiserahkan(payload = {}) {
      return apiFarmasiPost("/farmasi/prescriptions/batal-siap-diserahkan", payload);
    },
    async cetakETiket(uuid: string) {
      return apiFarmasiGet(`/farmasi/cetak/e-ticket/${uuid}`, {});
    },
    async cetakEResep(uuid: string) {
      return apiFarmasiGet(`/farmasi/cetak/e-resep/${uuid}`, {});
    },
  },
});
