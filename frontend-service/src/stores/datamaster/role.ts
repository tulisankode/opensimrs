import { defineStore } from "pinia";
import {
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
} from "@/utils/apiHandler";

export const useRoleStore = defineStore({
  id: "role",
  state: () => ({}),
  getters: {},
  actions: {
    // async dummy() {
    //   return {
    //     message: "Data IGD berhasil ditampilkan",
    //     payload: [
    //       {
    //         id: 1,
    //         uuid: "0192f686-bbde-7488-bae6-633c794d6198",
    //         code: "SPR-ADM",
    //         name: "Super Admin",
    //         permission: [
    //           {
    //             module: "Antrian",
    //             sub_modules: [
    //               {
    //                 name: "Konfigurasi",
    //                 allows: ["READ", "CREATE", "UPDATE", "DELETE"],
    //               },
    //               {
    //                 name: "Data Antrian",
    //                 allows: ["READ"],
    //               },
    //               {
    //                 name: "Layar",
    //                 allows: ["READ"],
    //               },
    //               {
    //                 name: "Apm",
    //                 allows: [
    //                   "CREATE PASIEN JKN",
    //                   "CREATE PASIEN NON-JKN",
    //                   "CHECKIN",
    //                   "PRINT",
    //                 ],
    //               },
    //             ],
    //           },
    //         ],
    //         status: true,
    //         createdAt: 1691846400,
    //         updatedAt: 1691846400,
    //         deletedAt: 0,
    //       },
    //       {
    //         id: 2,
    //         uuid: "0192f686-bc4e-78ca-831f-8322605073d1",
    //         code: "ADM",
    //         name: "Admin",
    //         permission: [
    //           {
    //             module: "Rawat Jalan",
    //             sub_modules: [
    //               {
    //                 name: "Antrian",
    //                 allows: ["PANGGIL", "LEWATI", "PROSSES", "SELESAI"],
    //               },
    //               {
    //                 name: "Poli",
    //                 allows: ["READ", "BATAL KUNJUNGAN"],
    //               },
    //               {
    //                 name: "BPJS-PCARE",
    //                 features: [
    //                   {
    //                     name: "Monitoring Kunjungan",
    //                     allows: ["READ", "CETAK BPJS"],
    //                   },
    //                   {
    //                     name: "Monitoring Riwayat Kunjungan",
    //                     allows: ["READ", "CETAK BPJS"],
    //                   },
    //                   {
    //                     name: "Monitoring Obat Kunjungan",
    //                     allows: ["READ", "CETAK BPJS"],
    //                   },
    //                 ],
    //               },
    //               {
    //                 name: "Laporan Rawat Jalan",
    //                 features: [
    //                   {
    //                     name: "Kunjungan",
    //                     allows: ["READ", "CETAK LAPORAN"],
    //                   },
    //                   {
    //                     name: "Pembatalan Poli",
    //                     allows: ["READ", "CETAK LAPORAN"],
    //                   },
    //                   {
    //                     name: "rekap Pembatalan Pasien",
    //                     allows: ["READ", "CETAK LAPORAN"],
    //                   },
    //                 ],
    //               },
    //               {
    //                 name: "RME",
    //                 features: [
    //                   {
    //                     name: "Rekap Medis",
    //                     allows: [
    //                       "READ",
    //                       "UPDATE PEMERIKSAAN GIGI",
    //                       "UPDATE PEMERIKSAAN MATA",
    //                       "UPDATE PEMERIKSAAN FISIK",
    //                       "UPDATE DERAJAT LUKA BAKAR",
    //                       "UPDATE PEMERIKSAAN DAN TINDAKAN",
    //                       "UPDATE REKAM MEDIS",
    //                       "CETAK LABEL",
    //                       "TUTUP SEMUA FORM",
    //                       "BUKA SEMUA FORM",
    //                       "RIWAYAT",
    //                       "SEMBUNYIKAN DETAIL PASIEN",
    //                       "TAMPILKAN DETAIL PASIEN",
    //                     ],
    //                   },
    //                   {
    //                     name: "Asemen",
    //                     allows: [
    //                       "READ",
    //                       "CETAK LABEL",
    //                       "RIWAYAT",
    //                       "SEMBUNYIKAN DETAIL PASIEN",
    //                       "TIDAK ADA ALERGI",
    //                       "CREATE ALERGI",
    //                       "CREATE ANAMNESIS",
    //                       "CREATE TANDA VITAL",
    //                       "CREATE ANTROPOMETRI",
    //                       "CREATE ASESMEN NYERI",
    //                       "CREATE KESADARAN",
    //                       "CREATE PEMERIKSAAN FISIK",
    //                       "CREATE PEMERIKSAAN GIGI",
    //                       "CREATE PEMERIKSAAN MATA",
    //                       "CREATE DERAJAT LUKA BAKAR",
    //                       "CREATE CATATAN HASIL PENUNJANG",
    //                       "CREATE DIAGNOSIS DOKTER",
    //                       "CREATE ASUHAN KEPERAWATAN",
    //                       "CREAT CATATAN PERAWAT",
    //                       "CREATE INSTRUKSI MEDIS",
    //                       "CREATE PEMERIKSAAN DAN TINDAKAN",
    //                     ],
    //                   },
    //                   {
    //                     name: "SOAP",
    //                     allows: [
    //                       "READ",
    //                       "CETAK LABEL",
    //                       "RIWAYAT",
    //                       "SEMBUNYIKAN DETAIL PASIEN",
    //                       "TUTUP SEMUA FORM",
    //                       "BUKA SEMUA FORM",
    //                       "CREATE OBAT",
    //                       "CREATE OBAT RACIKAN",
    //                       "UPDATE OBAT",
    //                       "DELETE OBAT",
    //                     ],
    //                   },
    //                   {
    //                     name: "Akses Dan Penunjang",
    //                     allows: [
    //                       "READ",
    //                       "CETAK LABEL",
    //                       "RIWAYAT",
    //                       "SEMBUNYIKAN DETAIL PASIEN",
    //                       "CREATE ALKES",
    //                       "CREATE ALKES MULTIPLE",
    //                       "DELETE LIST ALKES",
    //                       "DELETE ITEM ALKES MULTIPLE",
    //                       "DELETE SEMUA",
    //                       "AMBIL ITEM",
    //                       "SIMPAN ORDER",
    //                       "CREATE TINDAKAN",
    //                       "DELETE LIST TINDAKAN",
    //                     ],
    //                   },
    //                   {
    //                     name: "Inform Consent",
    //                     allows: [
    //                       "READ",
    //                       "CETAK LABEL",
    //                       "RIWAYAT",
    //                       "SEMBUNYIKAN DETAIL PASIEN",
    //                       "CREATE",
    //                     ],
    //                   },
    //                   {
    //                     name: "Unggah Berkas",
    //                     allows: [
    //                       "READ",
    //                       "UPDATE FILE TERUNGGAH",
    //                       "DELETE FILE TERUNGGAH",
    //                       "CETAK LABEL",
    //                       "RIWAYAT",
    //                       "MENYEMBUNYIKAN DETAIL PASIEN",
    //                       "CARI FILE",
    //                       "TAMPILAN LIST",
    //                       "TAMPILAN GRID",
    //                     ],
    //                   },
    //                   {
    //                     name: "Resume Dan Discarge",
    //                     allows: [
    //                       "READ",
    //                       "CETAK LABEL",
    //                       "RIWAYAT",
    //                       "SEMBUNYIKAN DETAIL PASIEN",
    //                       "TUTUP SEMUA FORM",
    //                       "BUKA SEMUA FORM",
    //                       "CETAK RESUME MEDIS",
    //                       "SIMPAN RESUME MEDIS",
    //                       "DISCHARGE",
    //                     ],
    //                   },
    //                   {
    //                     name: "Cetak Hasil Dan Surat",
    //                     allows: [
    //                       "READ",
    //                       "CETAK LABEL",
    //                       "RIWAYAT",
    //                       "SEMBUNYIKAN DETAIL PASIEN",
    //                       "TUTUP SEMUA FORM",
    //                       "BUKA SEMUA FORM",
    //                       "CETAK HASIL",
    //                       "CREATE SURAT",
    //                       "DELETE SURAT KETERANGAN",
    //                       "CETAK SURAT",
    //                     ],
    //                   },
    //                 ],
    //               },
    //             ],
    //           },
    //         ],
    //         status: true,
    //         createdAt: 1691846400,
    //         updatedAt: 1691846400,
    //         deletedAt: 0,
    //       },
    //     ],
    //     properties: {
    //       page: "1",
    //       total: 2,
    //       page_size: "10",
    //     },
    //   };
    // },
    async getApi(
      page: number = 1,
      limit: number = 10,
      name: String = "",
      payload = {}
    ) {
      return apiDatamasterGet(
        `/datamaster/role?page=${page}&limit=${limit}&name=${name}`,
        payload
      );
    },
    async getAktifApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/role/aktif`, payload);
    },
    async postApi(payload = {}) {
      return apiDatamasterPost("/datamaster/role", payload);
    },
    async putApi(uuid: string, payload = {}) {
      return apiDatamasterPut(`/datamaster/role/${uuid}`, payload);
    },
    async deleteApi(uuid: string, payload = {}) {
      return apiDatamasterDelete(`/datamaster/role/${uuid}`, payload);
    },
    async importApi(payload = {}) {
      return apiDatamasterPost(`/datamaster/role/import`, payload);
    },
    async exportApi(payload = {}) {
      return apiDatamasterGet(`/datamaster/role/export`, payload);
    },
  },
});
