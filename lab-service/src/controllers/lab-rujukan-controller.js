import successResponse from "../response/success-response.js";
import LabRujukanService from "../services/lab-rujukan-service.js";
import validateExcel from "../helpers/validator-excel.js";
import deletefile from "../helpers/file.js";
import errorResponse from "../response/error-response.js";
import { UniqueConstraintError } from "sequelize";

export default class LabRujukanController {
  static async create(req, res, next) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await LabRujukanService.create(req.body);
      return res.status(201).json(successResponse("Data berhasil disimpan"));
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return res.status(409).json(errorResponse("Kode sudah ada"));
      }
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const uuid = req.params.uuid;
      await LabRujukanService.update(uuid, req.body);
      return res.status(200).json(successResponse("Data berhasil diubah"));
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return res.status(409).json(errorResponse("Kode sudah ada"));
      }
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const uuid = req.params.uuid;
      await LabRujukanService.delete(uuid);
      return res.status(200).json(successResponse("Data berhasil dihapus"));
    } catch (error) {
      next(error);
    }
  }

  static async show(req, res, next) {
    try {
      const uuid = req.params.uuid;
      const labRujukan = await LabRujukanService.show(uuid);
      return res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", labRujukan));
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req, res, next) {
    try {
      req.body.name = req.query.name;
      req.body.page = req.query.page;
      req.body.limit = req.query.limit;
      req.body.faskes_uuid = req.author.faskesUuid;

      const labRujukans = await LabRujukanService.getAll(req.body);
      return res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", labRujukans));
    } catch (error) {
      next(error);
    }
  }

  static async getAllActive(req, res, next) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;

      const labRujukans = await LabRujukanService.getAllActive(req.body);
      return res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", labRujukans));
    } catch (error) {
      next(error);
    }
  }

  static async import(req, res, next) {
    try {
      validateExcel(req.file);
      await LabRujukanService.import(req.file.path, req.author.faskesUuid);
      deletefile(req.file.path);
      return res.status(201).json(successResponse("Data berhasil diimport"));
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return res.status(409).json(errorResponse("Kode sudah ada"));
      }
      next(error);
    }
  }
}
