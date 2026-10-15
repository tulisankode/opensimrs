import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import ProvinceService from "../services/province-service.js";
import path from "path";
import { messageErrorFileNotFound, messageErrorImport, messageErrorOnlyExcel } from "../validations/message-validation-error.js";
import { validateExcel } from "../helpers/helper.js";

export default class ProvinceController {
  static async createProvince(req, res, nextFunction) {
    try {
      const result = await ProvinceService.createProvince(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateProvince(req, res, nextFunction) {
    try {
      const result = await ProvinceService.updateProvince(req.params.id, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllProvince(req, res, nextFunction) {
    try {
      const result = await ProvinceService.getAllProvince();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllProvincePaginate(req, res, nextFunction) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.limit) || 10;
      const name = req.query.name;

      const result = await ProvinceService.getAllProvincePaginate(name, page, pageSize);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importProvince(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await ProvinceService.importProvince(req.file.path);
      await deleteFile(req.file.path);

      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async getProvinceById(req, res, nextFunction) {
    try {
      const result = await ProvinceService.getProvinceById(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteProvince(req, res, nextFunction) {
    try {
      const result = await ProvinceService.deleteProvince(req.params.id);
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
