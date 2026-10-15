import successResponse from "../responses/success-response.js";
import RiwayatService from "../services/riwayat-service.js";

export default class RiwayatController {
  static async getAll(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await RiwayatService.getAll(req.body);
      res
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

  static async getDetail(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await RiwayatService.getDetail(req.body);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }
}
