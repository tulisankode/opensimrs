import EksekutifService from "../services/eksekutif-service.js"

// Dashboard Eksekutif (STD-0034). Izin diperiksa di rute (routes/dashboard-routes.js) sebelum controller dipanggil.
export default class EksekutifController {
  static async getRingkasan(request, response, nextFunction) {
    try {
      const result = await EksekutifService.ringkasan(request.author, request.query)
      return response.status(200).json({ message: "Data dashboard eksekutif berhasil didapat", payload: result })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getRincian(request, response, nextFunction) {
    try {
      const result = await EksekutifService.rincian(request.author, request.params.kode, request.query)
      return response.status(200).json({ message: "Rincian indikator berhasil didapat", payload: result })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async postEkspor(request, response, nextFunction) {
    try {
      const result = await EksekutifService.ekspor(request.author, request.body ?? {})
      return response.status(200).json({ message: "Data ringkasan PDF berhasil disiapkan", payload: result })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getTarget(request, response, nextFunction) {
    try {
      const result = await EksekutifService.daftarTarget(request.author)
      return response.status(200).json({ message: "Target KPI berhasil didapat", payload: result })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async putTarget(request, response, nextFunction) {
    try {
      const result = await EksekutifService.simpanTarget(request.author, request.body ?? {})
      return response.status(200).json({ message: "Target KPI berhasil disimpan", payload: result })
    } catch (error) {
      nextFunction(error)
    }
  }
}
