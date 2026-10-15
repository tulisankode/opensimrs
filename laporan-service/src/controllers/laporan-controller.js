import LaporanService from "../services/laporan-service.js";

export default class LaporanController {
  static async getRekapitulasiKunjungan(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.getRekapitulasiKunjungan(author, query)

      return response.status(200).json({
        message: 'Data berhasil ditampilkan',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getRekapitulasiTindakan(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.getRekapitulasiTindakan(author, query)

      return response.status(200).json({
        message: 'Data berhasil ditampilkan',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getRekapitulasiLab(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.getRekapitulasiLab(author, query)

      return response.status(200).json({
        message: 'Data berhasil ditampilkan',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getRekapitulasiDiagnosis(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.getRekapitulasiDiagnosis(author, query)
      return response.status(200).json({
        message: 'Data berhasil ditampilkan',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async exportRekapitulasiKunjungan(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.exportRekapitulasiKunjungan(author, query)

      return response.status(200).send({
        message: 'Data berhasil di export',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async exportRekapitulasiTindakan(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.exportRekapitulasiTindakan(author, query)

      return response.status(200).send({
        message: 'Data berhasil di export',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async exportRekapitulasiLab(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.exportRekapitulasiLab(author, query)

      return response.status(200).send({
        message: 'Data berhasil di export',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }
  static async exportRekapitulasiDiagnosis(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await LaporanService.exportRekapitulasiDiagnosis(author, query)

      return response.status(200).send({
        message: 'Data berhasil di export',
        ...result
      })
    } catch (error) {
      nextFunction(error)
    }
  }
}
