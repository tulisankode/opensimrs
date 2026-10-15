import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import KecamatanService from "../services/kecamatan-service.js";
import BadRequestException from "../errors/bad_request-exception.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import path from "path";
import { validateExcel } from "../helpers/helper.js";

export default class KecamatanController {
  static async createKecamatan(req, res, nextFunction) {
    try {
      const result = await KecamatanService.createKecamatan(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateKecamatan(req, res, nextFunction) {
    try {
      const result = await KecamatanService.updateKecamatan(
        req.params.id,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllKecamatan(req, res, nextFunction) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.limit) || 10;
      const name = req.query.name;
      const kabupatenCode = req.query.kabupaten_code;

      if (kabupatenCode) {
        const result = await KecamatanService.getAllKecamatanByKabupatenCode(
          kabupatenCode
        );
        res.status(200).json(result);
      } else {
        const result = await KecamatanService.getAllKecamatan(
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

  static async importKecamatan(req, res, nextFunction) {
    try {
     validateExcel(req.file);
      const result = await KecamatanService.importKecamatan(req.file.path);
      await deleteFile(req.file.path);
      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async getKecamatanById(req, res, nextFunction) {
    try {
      const result = await KecamatanService.getKecamatanById(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteKecamatan(req, res, nextFunction) {
    try {
      const result = await KecamatanService.deleteKecamatan(req.params.id);
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
