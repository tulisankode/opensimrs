import DashboardRepository from "../repositories/dashboard-repository.js";
import DashboardValidator from "../validations/dashboard-validation.js";
import ZodValidator from "../validations/zod-validator.js";

export default class DashboardService {
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
