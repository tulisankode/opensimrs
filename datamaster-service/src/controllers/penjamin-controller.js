import PenjaminService from "../services/penjamin-service.js";
import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import path from "path";
import BadRequestException from "../errors/bad_request-exception.js";
import { validateExcel } from "../helpers/helper.js";

export default class PenjaminController {
  static async createPenjamin(req, res, nextFunction) {
    try {
      const body = {...req.body, faskes_uuid: req.author.faskesUuid};
      const result = await PenjaminService.createPenjamin(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updatePenjamin(req, res, nextFunction) {
    try {
      const result = await PenjaminService.updatePenjamin(
        req.params.uuid,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllPenjamin(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;
      const order_by = req.query.order_by ?? "DESC"

      const result = await PenjaminService.getAllPenjamin(name, page, pageSize, req.author.faskesUuid, order_by);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPenjaminAktif(req, res, nextFunction) {
    try {
      const penjaminList = await PenjaminService.getAllPenjaminAktif(req.author.faskesUuid);
      res.status(200).json(penjaminList);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPenjaminById(req, res, nextFunction) {
    try {
      const penjamin = await PenjaminService.getPenjaminById(req.params.uuid);
      res.status(200).json(penjamin);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importPenjamin(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await PenjaminService.importPenjamin(
        req.author.faskesUuid ?? faskes_uuid_dummy,
        req.file.path
      );
      await deleteFile(req.file.path);
      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportPenjamin(req, res, nextFunction) {
    try {
      const data = await PenjaminService.exportPenjamin();
      res.status(200).json(data);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deletePenjamin(req, res, nextFunction) {
    try {
      const penjamin = await PenjaminService.deletePenjamin(req.params.uuid);
      res.status(200).send(penjamin);
    } catch (error) {
      nextFunction(error);
    }
  }
}
