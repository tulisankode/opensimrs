import successResponse from "../responses/success-response.js";
import ReturService from "../services/retur-service.js";

export default class ReturController {
  static async create(req, res, nextFunction) {
    try {
      const data = req.body; 
      const author = req.author; 
      const token = req.headers.authorization; 

      const result = await ReturService.create(data, author, token);

      res.status(200).json(successResponse("Data berhasil diretur", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetail(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await ReturService.getDetail(req.query);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await ReturService.getAll(req.query);
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
}
