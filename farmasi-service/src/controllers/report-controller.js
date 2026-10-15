import ReportService from "../services/report-service.js";
import successResponse from "../responses/success-response.js";

export default class ReportController {
  static async getPendapatan(request, response, nextFunction) {
    try {
      request.query.faskes_uuid = request.author.faskesUuid;
      request.query.user = request.author.username;
      const result = await ReportService.getPendapatan(request.query);
      response
        .status(200)
        .json(
          successResponse(
            "Data berhasil ditampilkan",
            result.data,
            result.pagination
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getTat(request, response, nextFunction) {
    try {
      request.query.faskes_uuid = request.author.faskesUuid;
      request.query.user = request.author.username;
      const result = await ReportService.getTat(request.query);
      response
        .status(200)
        .json(
          successResponse(
            "Data berhasil ditampilkan",
            result.data,
            result.pagination
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPendapatanPerApotik(request, response, nextFunction) {
    try {
      request.query.faskes_uuid = request.author.faskesUuid;
      request.query.user = request.author.username;
      const result = await ReportService.getPendapatanPerApotik(request.query);
      response
        .status(200)
        .json(
          successResponse(
            "Data berhasil ditampilkan",
            result.data,
            result.pagination
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }
}
