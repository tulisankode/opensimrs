import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import KelurahanService from "../services/kelurahan-service.js";
import path from "path";
import BadRequestException from "../errors/bad_request-exception.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import { validateExcel } from "../helpers/helper.js";

export default class KelurahanController {
  static async createKelurahan(req, res, nextFunction) {
    try {
      const result = await KelurahanService.createKelurahan(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateKelurahan(req, res, nextFunction) {
    try {
      const result = await KelurahanService.updateKelurahan(
        req.params.id,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllKelurahanByKecamatanCode(req, res, nextFunction) {
    try {
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllKelurahan(req, res, nextFunction) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.limit) || 10;
      const name = req.query.name;
      const kecamatanCode = req.query.kecamatan_code;

      if (kecamatanCode) {
        const result = await KelurahanService.getAllKelurahanByKecamatnCode(
          kecamatanCode
        );
        res.status(200).json(result);
      } else {
        const result = await KelurahanService.getAllKelurahan(
          name,
          page,
          pageSize
        );
        res.status(200).json(result);
      }
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importKelurahan(req, res, nextFunction) {
    try {
     validateExcel(req.file);
      const result = await KelurahanService.importKelurahan(req.file.path);
      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async getKelurahanById(req, res, nextFunction) {
    try {
      const result = await KelurahanService.getKelurahanById(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteKelurahan(req, res, nextFunction) {
    try {
      const result = await KelurahanService.deleteKelurahan(req.params.id);
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
