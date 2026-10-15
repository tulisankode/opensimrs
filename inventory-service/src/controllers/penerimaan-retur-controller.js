import successResponse from "../responses/success-response.js";
import PenerimaanReturService from "../services/penerimaan-retur-service.js";

export default class PenerimaanReturController {
  static async getAll(req, res, nextFunction) {
    try {
      const options = {
        ...req.query,
        faskes_uuid: req.author.faskesUuid,
        headers: req.headers
      };
      const result = await PenerimaanReturService.getAll(options);
      res.status(200).json(successResponse( "Data berhasil ditampilkan", result.data, result.pagination));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetail(req, res, nextFunction) {
    try {
      const options = {
        ...req.query,       
        uuid: req.params.uuid, 
        headers: req.headers, 
        faskes_uuid: req.author.faskesUuid 
      };
      const data = await PenerimaanReturService.getDetail(options);
      res.status(200).json(successResponse("Data berhasil ditampilkan", data));
    } catch (error) {
      nextFunction(error);
    }
  }
}
