import ICD9Service from "../services/icd9-service.js";
import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
  messageErrorSave,
} from "../validations/message-validation-error.js";
import BadRequestException from "../errors/bad_request-exception.js";
import path from "path";
import { validateExcel } from "../helpers/helper.js";

export default class ICD9Controller {
  static async createICD9(req, res, nextFunction) {
    try {
      const result = await ICD9Service.createICD9(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateICD9(req, res, nextFunction) {
    try {
      const result = await ICD9Service.updateICD9(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllICD9(req, res, nextFunction) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.limit) || 10;
      const name = req.query.name;

      const result = await ICD9Service.getAllICD9(name, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importICD9(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await ICD9Service.importICD9(req.file.path);
      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportICD9(req, res, nextFunction) {
    try {
      const result = await ICD9Service.exportICD9();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllICD9Aktif(req, res, nextFunction) {
    try {
      const result = await ICD9Service.getAllICD9Aktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getICD9ById(req, res, nextFunction) {
    try {
      const result = await ICD9Service.getICD9ById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteICD9(req, res, nextFunction) {
    try {
      const result = await ICD9Service.deleteICD9(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
