import successResponse from "../responses/success-response.js";
import DatamasterLokasiStokService from "../services/datamaster-lokasi-stok-service.js";
import BadRequestException from "../errors/bad-request-exception.js";
import * as XLSX from "xlsx";
import DatamasterSatuanService from "../services/datamaster-satuan-service.js";
import Utils from "../helpers/utils.js";
import errorResponse from "../responses/error-response.js";

export default class DatamasterLokasiStokController {
  static async create(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await DatamasterLokasiStokService.create(req.body);
      res.status(201).json(successResponse("Data berhasil disimpan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await DatamasterLokasiStokService.getAll(req.query);

      if (result.data.length == 0) {
        res
          .status(404)
          .json(errorResponse("Data tidak ditemukan", result.data));
      } else {
        res
          .status(200)
          .json(
            successResponse(
              "Data berhasil ditampilkan",
              result.data,
              result.pagination
            )
          );
      }
    } catch (error) {
      nextFunction(error);
    }
  }

  static async update(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      req.body.uuid = uuid;
      await DatamasterLokasiStokService.update(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async delete(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      req.body.uuid = uuid;
      await DatamasterLokasiStokService.delete(req.body);
      res.status(200).json(successResponse("Data berhasil dihapus"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async import(req, res, nextFunction) {
    try {
      req.body.data = Utils.parseExcelToJSON(req);
      req.body.faskes_uuid = req.author.faskesUuid;

      const result = await DatamasterLokasiStokService.import(req.body);

      res.status(200).json(successResponse("data berhasil diimport", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async export(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await DatamasterLokasiStokService.export(req.query);
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
