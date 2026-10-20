import { defineStore } from "pinia";

import { apiRawatInapGet, apiRawatInapPost, apiRawatInapPut } from "@/utils/apiHandler";

export type NilaiIcu = { kodeParameter: string; nilai: string | number | boolean | null };
export type ElemenIcu = { kodeParameter: string; label: string; jenis: "angka" | "teks" | "boolean" | "pilihan"; satuan?: string; wajib?: boolean; minimum?: number; maksimum?: number; panjangMaksimum?: number; pilihan?: string[] };
export type TemplateIcu = { uuid: string; nama: string; layananKode: string; kodeTemplate: string; nomorVersi: number; status: string; revisi: number; definisi: { observasi: ElemenIcu[]; dokumen: { kodeDokumen: string; nama: string; elemen: ElemenIcu[] }[] }; aturanKelengkapan: any[] };
const kueriIcu = (data: Record<string, any>) => new URLSearchParams(Object.entries(data).filter(([,v]) => v !== undefined && v !== "").map(([k,v]) => [k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`), String(v)])).toString();
// Klien API dasar ruang perawatan intensif. ICU memakai basis "/icu"; CCU & HDU memakai basis "/ccu" & "/hdu" dengan
// endpoint dasar yang sama (episode, serah terima, flowsheet, balance cairan, laporan) — lihat
// rawat-inap-service/src/routes/intensif-routes.js. Komponen di components/RawatInap/ICU menerima prop `basis`.
export const apiIntensif = (basis = "/icu") => ({
  getDashboard: (payload = {}) => apiRawatInapGet(`${basis}/dashboard?${kueriIcu(payload)}`, {}),
  getPerawatan: (perawatanUuid: string, payload = {}) => apiRawatInapGet(`${basis}/perawatan/${perawatanUuid}`, payload),
  getPerpindahanSiap: (arah: "masuk" | "keluar", perawatanUuid?: string) => {
    const q = new URLSearchParams({ arah });
    if (perawatanUuid) q.set("perawatan_uuid", perawatanUuid);
    return apiRawatInapGet(`${basis}/perpindahan-siap?${q.toString()}`, {});
  },
  mulaiPerawatan: (perpindahanUuid: string, data: object) => apiRawatInapPost(`${basis}/perpindahan/${perpindahanUuid}/mulai`, data),
  keluarPerawatan: (perawatanUuid: string, data: object) => apiRawatInapPost(`${basis}/perawatan/${perawatanUuid}/keluar`, data),
  tambahObservasi: (perawatanUuid: string, data: object) => apiRawatInapPost(`${basis}/perawatan/${perawatanUuid}/observasi`, data),
  getObservasi: (perawatanUuid: string, dari?: number, sampai?: number) => {
    const q = new URLSearchParams();
    if (dari) q.set("dari", String(dari));
    if (sampai) q.set("sampai", String(sampai));
    return apiRawatInapGet(`${basis}/perawatan/${perawatanUuid}/observasi?${q.toString()}`, {});
  },
  koreksiObservasi: (observasiUuid: string, data: object) => apiRawatInapPost(`${basis}/observasi/${observasiUuid}/koreksi`, data),
  tambahIntakeOutput: (perawatanUuid: string, data: object) => apiRawatInapPost(`${basis}/perawatan/${perawatanUuid}/intake-output`, data),
  getBalance: (perawatanUuid: string, dari: number, sampai: number) =>
    apiRawatInapGet(`${basis}/perawatan/${perawatanUuid}/balance?dari=${dari}&sampai=${sampai}`, {}),
  getLaporan: (dari: number, sampai: number, ruanganUuid?: string, layananKode?: string) => {
    const q = new URLSearchParams({ dari: String(dari), sampai: String(sampai) });
    if (ruanganUuid) q.set("ruangan_uuid", ruanganUuid);
    if (layananKode) q.set("layanan_kode", layananKode);
    return apiRawatInapGet(`${basis}/laporan?${q.toString()}`, {});
  },
});

const icu = apiIntensif("/icu");

export const useIcuStore = defineStore({
    id: "icu",
    state: () => ({}),
    getters: {},
    actions: {
        async getLayanan(untukAdmisi = false) { return apiRawatInapGet(`/icu/layanan?untuk_admisi=${untukAdmisi}`, {}); },
        async getKonfigurasi() { return apiRawatInapGet("/icu/konfigurasi", {}); },
        async ubahLayanan(kode: string, data: object) { return apiRawatInapPut(`/icu/konfigurasi/layanan/${kode}`, data); },
        async ubahBed(uuid: string, data: object) { return apiRawatInapPut(`/icu/konfigurasi/bed/${uuid}`, data); },
        async ubahAkses(data: object) { return apiRawatInapPut("/icu/konfigurasi/akses-unit", data); },
        async getRiwayatKonfigurasi(halaman = 1) { return apiRawatInapGet(`/icu/konfigurasi/riwayat?halaman=${halaman}`, {}); },
        async getTemplate(data = {}, klinis = false) { return apiRawatInapGet(`/icu/template${klinis ? "/pilihan" : ""}?${kueriIcu(data)}`, {}); },
        async simpanTemplate(data: object, uuid?: string) { return uuid ? apiRawatInapPut(`/icu/template/${uuid}`, data) : apiRawatInapPost("/icu/template", data); },
        async tindakanTemplate(uuid: string, tindakan: string, data: object) { return apiRawatInapPost(`/icu/template/${uuid}/${tindakan}`, data); },
        async getDokumentasi(uuid: string, halaman = 1) { return apiRawatInapGet(`/icu/perawatan/${uuid}/dokumentasi?halaman=${halaman}`, {}); },
        async tambahDokumentasi(uuid: string, data: object) { return apiRawatInapPost(`/icu/perawatan/${uuid}/dokumentasi`, data); },
        async koreksiDokumentasi(uuid: string, data: object) { return apiRawatInapPost(`/icu/dokumentasi/${uuid}/koreksi`, data); },
        async getKelengkapan(uuid: string) { return apiRawatInapGet(`/icu/perawatan/${uuid}/kelengkapan`, {}); },
        async getRiwayat(uuid: string) { return apiRawatInapGet(`/icu/perawatan/${uuid}/riwayat`, {}); },
        async getLaporanKelengkapan(data: object) { return apiRawatInapGet(`/icu/laporan/kelengkapan?${kueriIcu(data)}`, {}); },
        async getDashboard(payload = {}) {
            return icu.getDashboard(payload);
        },
        async getPerawatan(perawatanUuid: string, payload = {}) {
            return icu.getPerawatan(perawatanUuid, payload);
        },
        async mulaiPerawatan(perpindahanUuid: string, data: object) {
            return icu.mulaiPerawatan(perpindahanUuid, data);
        },
        async keluarPerawatan(perawatanUuid: string, data: object) {
            return icu.keluarPerawatan(perawatanUuid, data);
        },
        async tambahObservasi(perawatanUuid: string, data: object) {
            return icu.tambahObservasi(perawatanUuid, data);
        },
        async getObservasi(perawatanUuid: string, dari?: number, sampai?: number) {
            return icu.getObservasi(perawatanUuid, dari, sampai);
        },
        async koreksiObservasi(observasiUuid: string, data: object) {
            return icu.koreksiObservasi(observasiUuid, data);
        },
        async tambahIntakeOutput(perawatanUuid: string, data: object) {
            return icu.tambahIntakeOutput(perawatanUuid, data);
        },
        async getBalance(perawatanUuid: string, dari: number, sampai: number) {
            return icu.getBalance(perawatanUuid, dari, sampai);
        },
        async tambahSkorSofa(perawatanUuid: string, data: object) {
            return apiRawatInapPost(`/icu/perawatan/${perawatanUuid}/skor-sofa`, data);
        },
        async getSkorSofa(perawatanUuid: string, payload = {}) {
            return apiRawatInapGet(`/icu/perawatan/${perawatanUuid}/skor-sofa`, payload);
        },
        async getLaporan(dari: number, sampai: number, ruanganUuid?: string, layananKode?: string) {
            return icu.getLaporan(dari, sampai, ruanganUuid, layananKode);
        },
    },
});
