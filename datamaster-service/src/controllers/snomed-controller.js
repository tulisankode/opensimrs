import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
  messageErrorSave,
} from "../validations/message-validation-error.js";
import SnomedService from "../services/snomed-service.js";
import path from "path";
import BadRequestException from "../errors/bad_request-exception.js";
import { validateExcel } from "../helpers/helper.js";

export default class SnomedController {
  static async createSnomed(req, res, nextFunction) {
    try {
      const result = await SnomedService.createSnomed(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateSnomed(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid
      const result = await SnomedService.updateSnomed(req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllSnomed(req, res, nextFunction) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.limit) || 10;
      const name = req.query.name;

      const result = await SnomedService.getAllSnomed(name, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importSnomed(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await SnomedService.importSnomed(req.file.path);
      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportSnomed(req, res, nextFunction) {
    try {
      const result = await SnomedService.exportSnomed();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllSnomedAktif(req, res, nextFunction) {
    try {
      const result = await SnomedService.getAllSnomedAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getSnomedById(req, res, nextFunction) {
    try {
      const result = await SnomedService.getSnomedById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteSnomed(req, res, nextFunction) {
    try {
      const result = await SnomedService.deleteSnomed(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
