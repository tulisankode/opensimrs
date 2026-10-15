import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import deleteFile from "../helpers/delete-file.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { validateExcel } from "../helpers/helper.js";
import GigiService from "../services/gigi-service.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import path from "path";

export default class GigiController {
  static async createGigi(req, res, nextFunction) {
    try {
      const result = await GigiService.createGigi(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateGigi(req, res, nextFunction) {
    try {
      const result = await GigiService.updateGigi(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllGigi(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const display = req.query.display;

      const result = await GigiService.getAllGigi(display, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getGigiAktif(req, res, nextFunction) {
    try {
      const result = await GigiService.getAllGigiAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getGigiByUuid(req, res, nextFunction) {
    try {
      const result = await GigiService.getGigiByUuid(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importGigi(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await GigiService.importGigi(req.file.path);

      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportGigi(req, res, nextFunction) {
    try {
      const result = await GigiService.exportGigi();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteGigi(req, res, nextFunction) {
    try {
      const result = await GigiService.deleteGigi(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
