import { defineStore } from "pinia";
import { apiAdmisiGet } from "@/utils/apiHandler";
import { apiAdmisiDownload } from "@/utils/apiHandler";

export const useAdmisiReportStore = defineStore({
  id: "admisiReport",
  getters: {},
  actions: {
    async getKunjunganReport(
      {
        page = 1,
        limit = 10,
        q = "",
        practitionerUuid = "",
        penjamin = "",
        jenisKunjungan = "",
        startDate = "",
        endDate = "",
        room = ""
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/report/kunjungan?page=${page}&limit=${limit}&q=${q}&practitioner_uuid=${practitionerUuid}&penjamin=${penjamin}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&room=${room}`,
        payload
      );
    },
    async getJenisKunjunganReport(
      {
        page = 1,
        limit = 10,
        q = "",
        practitionerUuid = "",
        penjamin = "",
        jenisKunjungan = "",
        startDate = "",
        endDate = "",
        room = ""
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/rekap/jenis-kunjungan?page=${page}&limit=${limit}&q=${q}&practitioner_uuid=${practitionerUuid}&penjamin=${penjamin}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&room=${room}`,
        payload
      );
    },
    async getDpjpReport(
      {
        page = 1,
        limit = 10,
        q = "",
        practitionerUuid = "",
        penjamin = "",
        jenisKunjungan = "",
        startDate = "",
        endDate = "",
        room = ""
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/rekap/dokter?page=${page}&limit=${limit}&q=${q}&practitioner_uuid=${practitionerUuid}&penjamin=${penjamin}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}&room=${room}`,
        payload
      );
    },
    // return {
    //   message: "berhasil mendapatkan data",
    //   payload: [
    //     {
    //       tglRegistrasi: 1728874066,
    //       noreg: "REG2410140001",
    //       noPelayanan: "RJ2410140001",
    //       jenisKunjungan: "RJ",
    //       patientUuid: "019288ec-b1c8-7670-979e-1835bd4a2a36",
    //       patient: {
    //         uuid: "019288ec-b1c8-7670-979e-1835bd4a2a36",
    //         title: "Mr.",
    //         name: "John Doe",
    //         identity: "KTP",
    //         noIdentity: "A123568231",
    //         phone: "+621234567890",
    //         gender: "Male",
    //         address: {
    //           prov: "Jawa Timur",
    //           city: "Jakarta Selatan",
    //           district: "Pancoran",
    //           rt: "01",
    //           rw: "02",
    //           fullAddress: "Jl. Raya No. 123",
    //           country: "Indonesia",
    //           village: "Kampung",
    //         },
    //         birthDetail: {
    //           ageYear: 34,
    //           ageMonth: 9,
    //           ageDay: 13,
    //           birthDate: "1990-01-01T00:00:00.000Z",
    //         },
    //       },
    //       practitioner: {
    //         title: "Ir",
    //         nama: "Rudi tabuti",
    //         gender: "L",
    //       },
    //       polyclinic: "Faskes Example",
    //     },
    //     {
    //       tglRegistrasi: 1728878342,
    //       noreg: "REG2410140002",
    //       noPelayanan: "RI2410140001",
    //       jenisKunjungan: "RI",
    //       patientUuid: "0192892d-f186-7af1-83d9-9728156a0fdb",
    //       patient: {
    //         uuid: "0192892d-f186-7af1-83d9-9728156a0fdb",
    //         title: "Mr.",
    //         name: "John Doe",
    //         identity: "KTP",
    //         noIdentity: "A123568231",
    //         phone: "+621234567890",
    //         gender: "Male",
    //         address: {
    //           prov: "Jawa Timur",
    //           city: "Jakarta Selatan",
    //           district: "Pancoran",
    //           rt: "01",
    //           rw: "02",
    //           fullAddress: "Jl. Raya No. 123",
    //           country: "Indonesia",
    //           village: "Kampung",
    //         },
    //         birthDetail: {
    //           ageYear: 34,
    //           ageMonth: 9,
    //           ageDay: 13,
    //           birthDate: "1990-01-01T00:00:00.000Z",
    //         },
    //       },
    //       practitioner: {
    //         title: "Ir",
    //         nama: "Rudi tabuti",
    //         gender: "L",
    //       },
    //       polyclinic: "-",
    //     },
    //     {
    //       tglRegistrasi: 1728880139,
    //       noreg: "REG2410140003",
    //       noPelayanan: "IGD2410140001",
    //       jenisKunjungan: "IGD",
    //       patientUuid: "01928949-5c05-7557-905f-2d2369eb7ec6",
    //       patient: {
    //         uuid: "01928949-5c05-7557-905f-2d2369eb7ec6",
    //         title: "Mr.",
    //         name: "John Doe",
    //         identity: "KTP",
    //         noIdentity: "A114563s8",
    //         phone: "+621234567890",
    //         gender: "Male",
    //         address: {
    //           prov: "Jawa Timur",
    //           city: "Jakarta Selatan",
    //           district: "Pancoran",
    //           rt: "01",
    //           rw: "02",
    //           fullAddress: "Jl. Raya No. 123",
    //           country: "Indonesia",
    //           village: "Kampung",
    //         },
    //         birthDetail: {
    //           ageYear: 34,
    //           ageMonth: 9,
    //           ageDay: 13,
    //           birthDate: "1990-01-01T00:00:00.000Z",
    //         },
    //       },
    //       practitioner: {
    //         title: "Ir",
    //         nama: "Rudi tabuti",
    //         gender: "L",
    //       },
    //       polyclinic: "-",
    //     },
    //   ],
    //   properties: {
    //     page: 1,
    //     pageSize: 10,
    //     totalPage: 1,
    //     totalData: 3,
    //     nextPage: null,
    //     prevPage: null,
    //   },
    // };
    async getPenjaminReport(
      {
        page = 1,
        limit = 10,
        q = "",
        practitionerUuid = "",
        penjamin = "",
        jenisKunjungan = "",
        startDate = "",
        endDate = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/rekap/penjamin?page=${page}&limit=${limit}&q=${q}&practitioner_uuid=${practitionerUuid}&penjamin=${penjamin}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
        payload
      );
    },
    async getBatalKunjunganReport(
      {
        page = 1,
        limit = 10,
        q = "",
        jenisKunjungan = "",
        startDate = "",
        endDate = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/report/cancel-visit?page=${page}&limit=${limit}&q=${q}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
        payload
      );
    },
    async getStatusRuanganReport(
      {
        page = 1,
        limit = 10,
        q = "",
        ruangan = "",
        startDate = "",
        endDate = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/report/room?page=${page}&limit=${limit}&q=${q}&room=${ruangan}&start_date=${startDate}&end_date=${endDate}`,
        payload
      );
    },
    async getKeperawatanInapReport(
      {
        page = 1,
        limit = 10,
        q = "",
        ruangan = "",
        startDate = "",
        endDate = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/report/rawat-inap?page=${page}&limit=${limit}&q=${q}&room=${ruangan}&start_date=${startDate}&end_date=${endDate}`,
        payload
      );
    },
    async getBayiBaruLahirReport(
      {
        page = 1,
        limit = 10,
        q = "",
        jenisKunjungan = "",
        startDate = "",
        endDate = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/report/new-born?page=${page}&limit=${limit}&q=${q}&jenis_kunjungan=${jenisKunjungan}&start_date=${startDate}&end_date=${endDate}`,
        payload
      );
    },
    async ExportKunjunganReport(
      {
        page = 1,
        limit = 10,
        q = "",
        penjamin = "",
        practitioner_uuid: practitionerUuid = "",
        jenis_kunjungan = "",
        start_date = "",
        end_date = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/export/kunjungan?page=${page}&limit=${limit}&q=${q}&penjamin=${penjamin}&practitioner_uuid=${practitionerUuid}&jenis_kunjungan=${jenis_kunjungan}&start_date=${start_date}&end_date=${end_date}`,
        payload
      );
    },
    async ExportBatalKunjunganReport(
      {
        page = 1,
        limit = 10,
        q = "",
        jenis_kunjungan = "",
        start_date = "",
        end_date = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/export/batal-kunjungan?page=${page}&limit=${limit}&q=${q}&jenis_kunjungan=${jenis_kunjungan}&start_date=${start_date}&end_date=${end_date}`,
        payload
      );
    },
    async ExportKeperawatanInapPasienReport(
      {
        page = 1,
        limit = 10,
        q = "",
        ruangan = "",
        start_date = "",
        end_date = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/export/keperawatan-inap?page=${page}&limit=${limit}&q=${q}&room=${ruangan}&start_date=${start_date}&end_date=${end_date}`,
        payload
      );
    },
    async ExportStatusKamarReport(
      {
        page = 1,
        limit = 10,
        q = "",
        ruangan = "",
        start_date = "",
        end_date = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/export/status-kamar?page=${page}&limit=${limit}&q=${q}&room=${ruangan}&start_date=${start_date}&end_date=${end_date}`,
        payload
      );
    },
    async ExportBayiBaruLahirReport(
      {
        page = 1,
        limit = 10,
        q = "",
        jenisKunjungan = "",
        start_date = "",
        end_date = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/export/new-born?page=${page}&limit=${limit}&q=${q}&jenis_kunjungan=${jenisKunjungan}&start_date=${start_date}&end_date=${end_date}`,
        payload
      );
    },
    async getRekapJenisKunjunganReport(
      {
        startDate = "",
        endDate = "",
        practitionerUuid = "",
        penjamin = "",
        jenisKunjungan = "",
      },
      payload = {}
    ) {
      return apiAdmisiGet(
        `/rekap/jenis-kunjungan?start_date=${startDate}&end_date=${endDate}&practitioner_uuid=${practitionerUuid}&penjamin=${penjamin}&jenis_kunjungan=${jenisKunjungan}`,
        payload
      );
    },
    async DownloadLaporanAdmisiReport() {
      return apiAdmisiDownload(`/download`);
    },
    // FIXME Belum mulai develop BPJS
    // async getJumlahBPJSReport({}, payload = {}) {
    //   return apiAdmisiGet(
    //     `/report/new-born?start_date=&end_date=&jenis_kunjungan=`,
    //     payload
    //   );
    // },
  },
});
