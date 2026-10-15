import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import KabupatenService from "../services/kabupaten-service.js";
import BadRequestException from "../errors/bad_request-exception.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import path from "path";
import { validateExcel } from "../helpers/helper.js";

export default class KabupatenController {
  static async createKabupaten(req, res, nextFunction) {
    try {
      const result = await KabupatenService.createKabupaten(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateKabupaten(req, res, nextFunction) {
    try {
      const result = await KabupatenService.updateKabupaten(
        req.params.id,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllKabupaten(req, res, nextFunction) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.limit) || 10;
      const name = req.query.name;
      const provinceCode = req.query.provinsi_code;

      if (provinceCode) {
        const result = await KabupatenService.getAllKabupatenByProvinceCode(
          provinceCode
        );
        res.status(200).json(result);
      } else {
        const result = await KabupatenService.getAllKabupaten(
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

  static async importKabupaten(req, res, nextFunction) {
    try {
     validateExcel(req.file);
      const result = await KabupatenService.importKabupaten(req.file.path);
      await deleteFile(req.file.path);

      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async getKabupatenById(req, res, nextFunction) {
    try {
      const result = await KabupatenService.getKabupatenById(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteKabupaten(req, res, nextFunction) {
    try {
      const result = await KabupatenService.deleteKabupaten(req.params.id);
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
