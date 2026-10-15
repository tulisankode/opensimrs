import successResponse from "../responses/success-response.js";
import DatamasterKategoriObatService from "../services/datamaster-kategori-obat-service.js";
import Utils from "../helpers/utils.js";
import DatamasterSatuanService from "../services/datamaster-satuan-service.js";

export default class DatamasterKategoriObatController {
  static async create(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await DatamasterKategoriObatService.create(req.body);
      res.status(201).json(successResponse("Data berhasil disimpan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await DatamasterKategoriObatService.getAll(req.query);
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
      await DatamasterKategoriObatService.update(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async delete(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      req.body.uuid = uuid;
      await DatamasterKategoriObatService.delete(req.body);
      res.status(200).json(successResponse("Data berhasil dihapus"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async import(req, res, nextFunction) {
    try {
      req.body.data = Utils.parseExcelToJSON(req);
      req.body.faskes_uuid = req.author.faskesUuid;

      const result = await DatamasterKategoriObatService.import(req.body);

      res.status(200).json(successResponse("data berhasil diimport"));
    } catch (error) {
      nextFunction(error);
    }
  }
}
