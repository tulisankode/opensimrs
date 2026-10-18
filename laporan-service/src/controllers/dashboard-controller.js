import DashboardService from "../services/dashboard-service.js"

export default class DashboardController {
  static async getRekapDashboard(request, response, nextFunction) {
    try {
      const { author, query } = request
      console.log(author)
      const result = await DashboardService.getRekapDashboard(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getTotalKunjunganRawatJalan(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await DashboardService.getTotalKunjunganRawatJalan(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getTotalKunjunganStatusRawat(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await DashboardService.getTotalKunjunganStatusRawat(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getTotalKunjunganPasien(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await DashboardService.getTotalKunjunganPasien(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getTotalKunjunganByGender(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await DashboardService.getTotalKunjunganByGender(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }
  static async getTotalPendapatan(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await DashboardService.getTotalPendapatan(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getRekapitulasiTopPoli(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await DashboardService.getRekapitulasiTopPoli(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }

  static async getRekapitulasiTopDPJP(request, response, nextFunction) {
    try {
      const { author, query } = request
      const result = await DashboardService.getRekapitulasiTopDPJP(author, query)
      return response.status(200).json({
        message: 'Data berhasil didapat',
        payload: result
      })
    } catch (error) {
      nextFunction(error)
    }
  }
}
