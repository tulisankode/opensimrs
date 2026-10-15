import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import deleteFile from "../helpers/delete-file.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { validateExcel } from "../helpers/helper.js";
import OklusiGigiService from "../services/oklusi_gigi-service.js";
import { messageErrorFileNotFound, messageErrorImport, messageErrorOnlyExcel } from "../validations/message-validation-error.js";
import path from "path";

export default class OklusiGigiController {
  static async createOklusiGigi(req, res, nextFunction) {
    try {
      const result = await OklusiGigiService.createOklusiGigi(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateOklusiGigi(req, res, nextFunction) {
    try {
      const result = await OklusiGigiService.updateOklusiGigi(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllOklusiGigi(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const display = req.query.display;

      const result = await OklusiGigiService.getAllOklusiGigi(display, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getOklusiGigiAktif(req, res, nextFunction) {
    try {
      const result = await OklusiGigiService.getAllOklusiGigiAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getOklusiGigiByUuid(req, res, nextFunction) {
    try {
      const result = await OklusiGigiService.getOklusiGigiByUuid(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importOklusiGigi(req, res, nextFunction) {
    try {
      validateExcel(req.file);

      const result = await OklusiGigiService.importOklusiGigi(req.file.path);
      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportOklusiGigi(req, res, nextFunction) {
    try {
      const result = await OklusiGigiService.exportOklusiGigi();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteOklusiGigi(req, res, nextFunction) {
    try {
      const result = await OklusiGigiService.deleteOklusiGigi(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
