import DiagnosisService from "../services/diagnosis-service.js";
import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import {
  messageErrorFileNotFound,
  messageErrorImport,
  messageErrorOnlyExcel,
} from "../validations/message-validation-error.js";
import path from "path";
import BadRequestException from "../errors/bad_request-exception.js";
import { validateExcel } from "../helpers/helper.js";

export default class DiagnosisController {
  static async createDiagnosis(req, res, nextFunction) {
    try {
      const result = await DiagnosisService.createDiagnosis(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateDiagnosis(req, res, nextFunction) {
    try {
      const result = await DiagnosisService.updateDiagnosis(
        req.params.uuid,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllDiagnosis(req, res, nextFunction) {
    try {
      const page = req.query.page ?? 1;
      const pageSize = req.query.limit ?? 10;
      const name = req.query.name ?? null;
      const order_by = req.query.order_by ?? "DESC";
      const faskes_uuid = req.author.faskesUuid;
      const result = await DiagnosisService.getAllDiagnosis({name, page, pageSize, order_by, faskes_uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllDiagnosisAktif(req, res, nextFunction) {
    try {
      const result = await DiagnosisService.getAllDiagnosisAktif();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importDiagnosis(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await DiagnosisService.importDiagnosis(req.file.path);
      await deleteFile(req.file.path);

      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportDiagnosis(req, res, nextFunction) {
    try {
      const result = await DiagnosisService.exportDiagnosis();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDiagnosisById(req, res, nextFunction) {
    try {
      const result = await DiagnosisService.getDiagnosisById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteDiagnosis(req, res, nextFunction) {
    try {
      const result = await DiagnosisService.deleteDiagnosis(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
