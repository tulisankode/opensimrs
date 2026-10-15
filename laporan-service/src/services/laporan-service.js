import writeXlsxFile from "write-excel-file";
import LaporanRepository from "../repositories/laporan-repository.js";
import LaporanValidator from "../validations/laporan-validation.js";
import ZodValidator from "../validations/zod-validator.js";

const PaymentMethodEnum = {
  1: 'tunai',
  2: 'asuransi'
}

const VisitTypeEnum = {
  'rj': 'rawat_jalan',
  'ri': 'rawat_inap',
  'rajal': 'rawat_jalan',
  'ranap': 'rawat_inap',
  'igd': 'igd',
  'aps': 'aps'
}

export default class LaporanService {
  static async getRekapitulasiKunjungan(author, filter) {
    const { limit, offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.KUNJUNGAN, filter)
    const [data, total] = await LaporanRepository.getRekapitulasiKunjungan({ faskes_uuid: author.faskesUuid, filter: validatedFilter, limit, offset })

    data.map((item) =>
      item.payment_method = PaymentMethodEnum[item.payment_method],
    )

    // Handling pagination
    const pagination = this.paginate({ total: parseInt(total), limit, offset })

    return {
      properties: {
        ...pagination
      },
      payload: data,

    }
  }

  static async getRekapitulasiTindakan(author, filter) {
    const { limit, offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.TINDAKAN, filter)
    const [data, total] = await LaporanRepository.getRekapitulasiTindakan({ faskes_uuid: author.faskesUuid, filter: validatedFilter, limit, offset })

    data.map((item) => {
      item.payment_method = PaymentMethodEnum[item.payment_method]
      item.visit_type = VisitTypeEnum[item.visit_type]
    })

    // Handling pagination
    const pagination = this.paginate({ total: parseInt(total), limit, offset })

    return {
      properties: {
        ...pagination
      },
      payload: data,

    }
  }

  static async getRekapitulasiLab(author, filter) {
    const { limit, offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.LAB, filter)
    const [data, total] = await LaporanRepository.getRekapitulasiLab({ faskes_uuid: author.faskesUuid, filter: validatedFilter, limit, offset })

    data.map((item) => {
      item.payment_method = PaymentMethodEnum[item.payment_method]
      item.visit_type = VisitTypeEnum[item.visit_type] ?? item.visit_type
    })

    //Handling pagination
    const pagination = this.paginate({ total: parseInt(total), limit, offset })

    return {
      properties: {
        ...pagination
      },
      payload: data
    }
  }

  static async getRekapitulasiDiagnosis(author, filter) {
    const { limit, offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.DIAGNOSIS, filter)
    const rekamMedises = await LaporanRepository.getDiagnosisFromMongo({ faskes_uuid: author.faskesUuid })
    const [data, total] = await LaporanRepository.getRekapitulasiDiagnosis({ faskes_uuid: author.faskesUuid, rekamMedises, filter: validatedFilter, limit, offset })

    const pagination = this.paginate({ total: parseInt(total), limit, offset })

    return {
      properties: {
        ...pagination
      },
      payload: data
    }
  }

  static async exportRekapitulasiKunjungan(author, filter) {
    const { limit: _limit, offset: _offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.KUNJUNGAN, filter)

    const [data] = await LaporanRepository.getRekapitulasiKunjungan({ faskes_uuid: author.faskesUuid, filter: validatedFilter, limit: null, offset: null })

    data.map((item) => {
      item.payment_method = PaymentMethodEnum[item.payment_method]
    })

    return { payload: data }
  }

  static async exportRekapitulasiTindakan(author, filter) {
    const { limit: _limit, offset: _offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.TINDAKAN, filter)

    const [data] = await LaporanRepository.getRekapitulasiTindakan({ faskes_uuid: author.faskesUuid, filter: validatedFilter, limit: null, offset: null })

    data.map((item) => {
      item.payment_method = PaymentMethodEnum[item.payment_method]
      item.visit_type = VisitTypeEnum[item.visit_type] ?? item.visit_type
    })

    return { payload: data }
  }

  static async exportRekapitulasiLab(author, filter) {
    const { limit: _limit, offset: _offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.LAB, filter)

    const [data] = await LaporanRepository.getRekapitulasiLab({ faskes_uuid: author.faskesUuid, filter: validatedFilter, limit: null, offset: null })

    data.map((item) => {
      item.payment_method = PaymentMethodEnum[item.payment_method]
      item.visit_type = VisitTypeEnum[item.visit_type] ?? item.visit_type
    })

    return { payload: data }
  }

  static async exportRekapitulasiDiagnosis(author, filter) {
    const { limit: _limit, offset: _offset, ...validatedFilter } = ZodValidator.validate(LaporanValidator.DIAGNOSIS, filter)
    const rekamMedises = await LaporanRepository.getDiagnosisFromMongo({ faskes_uuid: author.faskesUuid })
    const [data] = await LaporanRepository.getRekapitulasiDiagnosis({ faskes_uuid: author.faskesUuid, rekamMedises, filter: validatedFilter })

    return { payload: data }
  }

  static paginate({ total, limit, offset }) {
    const page = Math.floor(offset / limit) + 1
    // const totalPages = Math.ceil(total / limit)
    // const nextPage = page < totalPages ? page + 1 : null
    // const prevPage = page > 1 ? page - 1 : null

    return {
      page,
      //total_pages: totalPages,
      total,
      page_size: limit,
      //next_page: nextPage,
      //prev_page: prevPage,
    }
  }
}
