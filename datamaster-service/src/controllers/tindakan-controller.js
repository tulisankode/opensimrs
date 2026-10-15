import TindakanService from "../services/tindakan-service.js";
import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { messageErrorFileNotFound, messageErrorImport, messageErrorOnlyExcel } from "../validations/message-validation-error.js";
import path from "path";
import BadRequestException from "../errors/bad_request-exception.js";
import { validateExcel } from "../helpers/helper.js";

export default class TindakanController {
  static async createTindakan(req, res, nextFunction) {
    try {
      const body = {...req.body, faskes_uuid: req.author.faskesUuid};
      const result = await TindakanService.createTindakan(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateTindakan(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await TindakanService.updateTindakan(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllTindakan(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;
      const faskes_uuid = req.author.faskesUuid;
      const result = await TindakanService.getAllTindakan(name, page, pageSize, faskes_uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
  static async getAllTindakanAktif(req, res, nextFunction) {
    try {
      const result = await TindakanService.getAllTindakanAktif(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importTindakan(req, res, nextFunction) {
    try {
      validateExcel(req.file);

      const result = await TindakanService.importTindakan(req.author.faskesUuid ?? faskes_uuid_dummy, req.file.path);
      await deleteFile(req.file.path);

      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportTindakan(req, res, nextFunction) {
    try {
      const result = await TindakanService.exportTindakan(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      console.log(error);
      nextFunction(error);
    }
  }

  static async getTindakanById(req, res, nextFunction) {
    try {
      const result = await TindakanService.getTindakanById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteTindakan(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid;
      const faskes_uuid = req.author.faskesUuid;
      const result = await TindakanService.deleteTindakan({uuid, faskes_uuid});
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
