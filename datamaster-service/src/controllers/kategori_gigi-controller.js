import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import deleteFile from "../helpers/delete-file.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { validateExcel } from "../helpers/helper.js";
import KategoriGigiService from "../services/kategori_gigi-service.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import path from "path";

export default class KategoriGigiController {
  static async createKategoriGigi(req, res, nextFunction) {
    try {
      const result = await KategoriGigiService.createKategoriGigi(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateKategoriGigi(req, res, nextFunction) {
    try {
      const result = await KategoriGigiService.updateKategoriGigi(
        req.params.uuid,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllKategoriGigi(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const display = req.query.display;

      const result = await KategoriGigiService.getAllKategoriGigi(
        display,
        page,
        pageSize
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getKategoriGigiAktif(req, res, nextFunction) {
    try {
      const result = await KategoriGigiService.getAllKategoriGigiAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getKategoriGigiByUuid(req, res, nextFunction) {
    try {
      const result = await KategoriGigiService.getKategoriGigiByUuid(
        req.params.uuid
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importKategoriGigi(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await KategoriGigiService.importKategoriGigi(req.author.faskesUuid, req.file.path);
      await deleteFile(req.file.path);
      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportKategoriGigi(req, res, nextFunction) {
    try {
      const result = await KategoriGigiService.exportKategoriGigi();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteKategoriGigi(req, res, nextFunction) {
    try {
      const result = await KategoriGigiService.deleteKategoriGigi(
        req.params.uuid
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
