import SuratService from "../services/surat-service.js";
import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { messageErrorFileNotFound } from "../validations/message-validation-error.js";
import { validateExcel } from "../helpers/helper.js";

export default class SuratController {
  static async createSurat(req, res, nextFunction) {
    try {
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      const result = await SuratService.createSurat(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateSurat(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.uuid = req.params.uuid;
      const result = await SuratService.updateSurat(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllSurat(req, res, nextFunction) {
    try {
      const page = req.query.page || 1;
      const pageSize = req.query.limit || 10;
      const name = req.query.name ?? null;
      const order_by = req.query.order_by || "DESC";
      const faskes_uuid = req.author.faskesUuid;

      const result = await SuratService.getAllSurat({page, pageSize, name, order_by, faskes_uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllSuratAktif(req, res, nextFunction) {
    try {
      const result = await SuratService.getAllSuratAktif(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async exportSurat(req, res, nextFunction) {
    try {
      const result = await SuratService.exportSurat();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getSuratById(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid ?? null;
      const uuid = req.params.uuid ?? null;
      const result = await SuratService.getSuratById({uuid, faskes_uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteSurat(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid ?? null;
      const uuid = req.params.uuid ?? null;
      const result = await SuratService.deleteSurat({uuid, faskes_uuid});
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
