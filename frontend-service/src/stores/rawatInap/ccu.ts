import { defineStore } from "pinia";

import { apiRawatInapGet, apiRawatInapPost, apiRawatInapPut } from "@/utils/apiHandler";
import { apiIntensif } from "@/stores/rawatInap/icu";

// CCU memakai endpoint dasar perawatan intensif (episode, serah terima, flowsheet, balance cairan, laporan) dengan
// basis "/ccu" (lihat apiIntensif) + endpoint data kardiologi khusus CCU di bawah.
const dasar = apiIntensif("/ccu");

export const useCcuStore = defineStore({
  id: "ccu",
  state: () => ({}),
  getters: {},
  actions: {
    ...dasar,
    async getDashboardKardiak() {
      return apiRawatInapGet(`/ccu/dashboard/kardiak`, {});
    },
    async getLaporanKardiak(dari: number, sampai: number) {
      return apiRawatInapGet(`/ccu/laporan/kardiak?dari=${dari}&sampai=${sampai}`, {});
    },
    async getKlinis(perawatanUuid: string) {
      return apiRawatInapGet(`/ccu/perawatan/${perawatanUuid}/klinis`, {});
    },
    async simpanKlinis(perawatanUuid: string, data: object) {
      return apiRawatInapPut(`/ccu/perawatan/${perawatanUuid}/klinis`, data);
    },
    async getEkg(perawatanUuid: string) {
      return apiRawatInapGet(`/ccu/perawatan/${perawatanUuid}/ekg`, {});
    },
    async tambahEkg(perawatanUuid: string, data: object) {
      return apiRawatInapPost(`/ccu/perawatan/${perawatanUuid}/ekg`, data);
    },
    async batalEkg(uuid: string, alasan: string) {
      return apiRawatInapPost(`/ccu/ekg/${uuid}/batal`, { alasan });
    },
    async getPenanda(perawatanUuid: string) {
      return apiRawatInapGet(`/ccu/perawatan/${perawatanUuid}/penanda-jantung`, {});
    },
    async tambahPenanda(perawatanUuid: string, data: object) {
      return apiRawatInapPost(`/ccu/perawatan/${perawatanUuid}/penanda-jantung`, data);
    },
    async batalPenanda(uuid: string, alasan: string) {
      return apiRawatInapPost(`/ccu/penanda-jantung/${uuid}/batal`, { alasan });
    },
    async getSkor(perawatanUuid: string) {
      return apiRawatInapGet(`/ccu/perawatan/${perawatanUuid}/skor-risiko`, {});
    },
    async tambahSkor(perawatanUuid: string, data: object) {
      return apiRawatInapPost(`/ccu/perawatan/${perawatanUuid}/skor-risiko`, data);
    },
    async getIntervensi(perawatanUuid: string) {
      return apiRawatInapGet(`/ccu/perawatan/${perawatanUuid}/intervensi`, {});
    },
    async tambahIntervensi(perawatanUuid: string, data: object) {
      return apiRawatInapPost(`/ccu/perawatan/${perawatanUuid}/intervensi`, data);
    },
    async batalIntervensi(uuid: string, alasan: string) {
      return apiRawatInapPost(`/ccu/intervensi/${uuid}/batal`, { alasan });
    },
  },
});

// Label tampilan nilai enum CCU (kode API snake_case → teks Indonesia).
export const LABEL_SINDROM: Record<string, string> = {
  stemi: "STEMI",
  nstemi: "NSTEMI",
  angina_tidak_stabil: "Angina pektoris tidak stabil",
  gagal_jantung_akut: "Gagal jantung akut",
  syok_kardiogenik: "Syok kardiogenik",
  aritmia: "Aritmia",
  pasca_pci: "Pasca PCI",
  pasca_bedah_jantung: "Pasca bedah jantung",
  miokarditis_perikarditis: "Miokarditis/perikarditis",
  emboli_paru: "Emboli paru",
  lainnya: "Lainnya",
};
export const LABEL_IRAMA: Record<string, string> = {
  sinus: "Irama sinus",
  sinus_takikardia: "Sinus takikardia",
  sinus_bradikardia: "Sinus bradikardia",
  fibrilasi_atrium: "Fibrilasi atrium",
  flutter_atrium: "Flutter atrium",
  svt: "SVT",
  vt: "VT (takikardia ventrikel)",
  vf: "VF (fibrilasi ventrikel)",
  torsades: "Torsades de pointes",
  blok_av_1: "Blok AV derajat 1",
  blok_av_2: "Blok AV derajat 2",
  blok_av_3: "Blok AV derajat 3 (total)",
  irama_pacu: "Irama pacu",
  asistol: "Asistol",
  pea: "PEA",
  lainnya: "Lainnya",
};
export const IRAMA_BERBAHAYA = ["vt", "vf", "asistol", "pea", "blok_av_3", "torsades"];
export const LABEL_PENANDA: Record<string, string> = {
  troponin_i: "Troponin I",
  troponin_t: "Troponin T",
  hs_troponin_i: "hs-Troponin I",
  hs_troponin_t: "hs-Troponin T",
  ck_mb: "CK-MB",
  ck: "CK total",
  nt_probnp: "NT-proBNP",
  bnp: "BNP",
  d_dimer: "D-dimer",
  kalium: "Kalium",
  magnesium: "Magnesium",
};
export const LABEL_INTERVENSI: Record<string, string> = {
  pci_primer: "PCI primer",
  pci: "PCI (elektif/urgen)",
  angiografi_koroner: "Angiografi koroner",
  trombolisis: "Trombolisis (fibrinolitik)",
  pacu_jantung_sementara: "Pacu jantung sementara",
  iabp: "IABP",
  kardioversi: "Kardioversi",
  defibrilasi: "Defibrilasi",
  rjp: "RJP",
  perikardiosentesis: "Perikardiosentesis",
  lainnya: "Lainnya",
};
export const opsi = (label: Record<string, string>) => Object.entries(label).map(([value, l]) => ({ value, label: l }));
export const tampilWaktu = (detik?: number | null) => (detik ? new Date(detik * 1000).toLocaleString("id-ID") : "-");
