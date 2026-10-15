import successResponse from "../responses/success-response.js";
import DatamasterBentukSediaanService from "../services/datamaster-bentuk-sediaan-service.js";
import Utils from "../helpers/utils.js";
import DatamasterSatuanService from "../services/datamaster-satuan-service.js";

export default class DatamasterBentukSediaanController {
  static async create(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await DatamasterBentukSediaanService.create(req.body);
      res.status(201).json(successResponse("Data berhasil disimpan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await DatamasterBentukSediaanService.getAll(req.query);
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

  static async update(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      req.body.uuid = uuid;
      await DatamasterBentukSediaanService.update(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async delete(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      req.body.uuid = uuid;
      await DatamasterBentukSediaanService.delete(req.body);
      res.status(200).json(successResponse("Data berhasil dihapus"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async import(req, res, nextFunction) {
    try {
      req.body.data = Utils.parseExcelToJSON(req);
      req.body.faskes_uuid = req.author.faskesUuid;

      const result = await DatamasterBentukSediaanService.import(req.body);

      res.status(200).json(successResponse("data berhasil diimport"));
    } catch (error) {
      nextFunction(error);
    }
  }
}
