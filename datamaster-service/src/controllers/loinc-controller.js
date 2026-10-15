import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import LoincService from "../services/loinc-service.js";
import BadRequestException from "../errors/bad_request-exception.js";
import path from "path";
import { validateExcel } from "../helpers/helper.js";

export default class LoincController {
  static async createLoinc(req, res, nextFunction) {
    try {
      const result = await LoincService.createLoinc(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateLoinc(req, res, nextFunction) {
    try {
      const result = await LoincService.updateLoinc(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllLoinc(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;

      const result = await LoincService.getAllLoinc(name, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importLoinc(req, res, nextFunction) {
    try {
     validateExcel(req.file);
      const result = await LoincService.importLoinc(req.file.path);
      await deleteFile(req.file.path);

      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportLoinc(req, res, nextFunction) {
    try {
      const result = await LoincService.exportLoinc();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllLoincAktif(req, res, nextFunction) {
    try {
      const result = await LoincService.getAllLoincAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getLoincById(req, res, nextFunction) {
    try {
      const result = await LoincService.getLoincById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteLoinc(req, res, nextFunction) {
    try {
      const result = await LoincService.deleteLoinc(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
