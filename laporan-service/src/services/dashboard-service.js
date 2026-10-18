import DashboardRepository from "../repositories/dashboard-repository.js";
import DashboardValidator from "../validations/dashboard-validation.js";
import ZodValidator from "../validations/zod-validator.js";

export default class DashboardService {
  static async getDashboardEksekutif(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const sumber = [
      ["kunjungan", () => DashboardRepository.getTotalKunjungan({ faskes_uuid: author.faskesUuid, filter: validatedFilter })],
      ["pendapatan", () => DashboardRepository.getTotalPendapatanKlinik({ faskes_uuid: author.faskesUuid, filter: validatedFilter })],
      ["poli", () => DashboardRepository.getRekapitulasiTopPoli({ faskes_uuid: author.faskesUuid, filter: validatedFilter })],
      ["dokter", () => DashboardRepository.getRekapitulasiTopDPJP({ faskes_uuid: author.faskesUuid, filter: validatedFilter })]
    ]
    const hasil = await Promise.allSettled(sumber.map(([, ambil]) => ambil()))
    const data = Object.fromEntries(hasil.map((item, index) => [
      sumber[index][0],
      item.status === "fulfilled" ? { status_data: "tersedia", nilai: item.value } : { status_data: "gagal", nilai: null }
    ]))

    return {
      periode: { mulai: validatedFilter.startDate ?? null, selesai: validatedFilter.endDate ?? null },
      diperbarui_pada: Math.floor(Date.now() / 1000),
      indikator: {
        kunjungan: data.kunjungan,
        pendapatan: data.pendapatan,
        kunjungan_per_poli: data.poli,
        kunjungan_per_dokter: data.dokter,
        rawat_inap: { status_data: "belum_tersedia", nilai: null },
        mutu: { status_data: "belum_tersedia", nilai: null },
        sdm: { status_data: "belum_tersedia", nilai: null },
        klaim_dan_piutang: { status_data: "belum_tersedia", nilai: null },
        target_kpi: { status_data: "belum_tersedia", nilai: null },
        ekspor_pdf: { status_data: "belum_tersedia", nilai: null }
      }
    }
  }

  static async getRekapDashboard(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)

    const [totalKunjungan, totalTransaksi, totalPendapatan, totalPasienBatal, totalPasienBaru] = await Promise.all([
      DashboardRepository.getTotalKunjungan({ faskes_uuid: author.faskesUuid, filter: validatedFilter }),
      DashboardRepository.getTotalTransaksiObat({ faskes_uuid: author.faskesUuid, filter: validatedFilter }),
      DashboardRepository.getTotalPendapatanKlinik({ faskes_uuid: author.faskesUuid, filter: validatedFilter }),
      DashboardRepository.getTotalPasienBatal({ faskes_uuid: author.faskesUuid, filter: validatedFilter }),
      DashboardRepository.getTotalPasienBaru({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    ])

    const results = {
      totalKunjungan,
      totalTransaksi,
      totalPendapatan,
      totalPasienBatal,
      totalPasienBaru
    }

    return results
  }

  static async getTotalKunjunganRawatJalan(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const result = await DashboardRepository.getTotalKunjunganRawatJalan({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    return result
  }

  static async getTotalKunjunganStatusRawat(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const result = await DashboardRepository.getTotalKunjunganStatusRawat({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    return result
  }

  static async getTotalKunjunganPasien(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const result = await DashboardRepository.getTotalKunjunganPasien({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    return result
  }

  static async getTotalKunjunganByGender(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const result = await DashboardRepository.getTotalKunjunganByGender({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    return result
  }

  static async getTotalPendapatan(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const result = await DashboardRepository.getTotalPendapatan({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    return result
  }

  static async getRekapitulasiTopPoli(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const result = await DashboardRepository.getRekapitulasiTopPoli({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    return result
  }

  static async getRekapitulasiTopDPJP(author, filter) {
    const validatedFilter = ZodValidator.validate(DashboardValidator.DASHBOARD, filter)
    const result = await DashboardRepository.getRekapitulasiTopDPJP({ faskes_uuid: author.faskesUuid, filter: validatedFilter })
    return result
  }

}
