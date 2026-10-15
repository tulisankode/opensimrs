import BadRequestException from "../errors/bad_request-exception.js";
import NotFoundException from "../errors/notfound-exception.js";
import deleteFile from "../helpers/delete-file.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { validateExcel } from "../helpers/helper.js";
import ItemGigiService from "../services/item_gigi-service.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
  messageErrorSave,
} from "../validations/message-validation-error.js";
import path from "path";

export default class ItemGigiController {
  static async createItemGigi(req, res, nextFunction) {
    try {
      const result = await ItemGigiService.createItemGigi(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateItemGigi(req, res, nextFunction) {
    try {
      const result = await ItemGigiService.updateItemGigi(
        req.params.uuid,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllItemGigi(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;

      const result = await ItemGigiService.getAllItemGigi(name, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getItemGigiAktif(req, res, nextFunction) {
    try {
      const result = await ItemGigiService.getAllItemGigiAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getItemGigiByUuid(req, res, nextFunction) {
    try {
      const result = await ItemGigiService.getItemGigiByUuid(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importItemGigi(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await ItemGigiService.importItemGigi(req.file.path);
      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportItemGigi(req, res, nextFunction) {
    try {
      const result = await ItemGigiService.exportItemGigi();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteItemGigi(req, res, nextFunction) {
    try {
      const result = await ItemGigiService.deleteItemGigi(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
