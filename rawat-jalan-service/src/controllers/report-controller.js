import ReportService from "../services/report-service.js";
import successResponse from "../responses/success-response.js";

export default class ReportController {
  static async getAllKunjungan(req, res, next) {
      try {
          const result = await ReportService.getAllKunjungan(req.query);
          return res.status(200).json(successResponse("Data Kunjungan RJ berhasil ditampilkan", result));
      } catch (error) {
          next(error);
      }
  }

  static async getCancelKunjungan(req, res, next) {
      try {
          const result = await ReportService.getCancelKunjungan(req.query);
          return res.status(200).json(successResponse("Data Batal Kunjungan RJ berhasil ditampilkan", result));
      } catch (error) {
          next(error);
      }
  }

  static async getTindakans(request, response, nextFunction) {
    try {
        const result = await ReportService.getTindakans(request.query);
        response.status(200).json(successResponse("Data Rekap Tindakan Pasien berhasil ditampilkan", result));
    } catch (error) {
      console.log(error);
      nextFunction(error);
    }
  }
}
