import deleteFile from "../helpers/delete-file.js";
import NotFoundException from "../errors/notfound-exception.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import PegawaiService from "../services/pegawai-service.js";
import { messageErrorFileNotFound, messageErrorImport, messageErrorOnlyExcel } from "../validations/message-validation-error.js";
import path from "path";
import BadRequestException from "../errors/bad_request-exception.js";
import { validateExcel } from "../helpers/helper.js";

export default class PegawaiController {
  static async createPegawai(req, res, nextFunction) {
    try {
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      const result = await PegawaiService.createPegawai(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updatePegawai(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await PegawaiService.updatePegawai(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllPegawai(req, res, nextFunction) {
    try {
      const page = req.query.page ?? 1;
      const pageSize = req.query.limit ?? 10;
      const name = req.query.name ?? null;
      const type = req.query.type ?? null;
      const faskes_uuid = req.author.faskesUuid ?? null;
      const order_by = req.query.order_by ?? "DESC";
      const result = await PegawaiService.getAllPegawai(name, type, page, pageSize, order_by, faskes_uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPegawaiAktif(req, res, nextFunction) {
    try {
      const type = req.query.type ?? null;
      const faskes_uuid = req.author.faskesUuid;
      const order_by = req.query.order_by ?? "DESC";
      const result = await PegawaiService.getAllPegawaiAktif({faskes_uuid, type, order_by});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getPegawaiById(req, res, nextFunction) {
    try {
      const result = await PegawaiService.getPegawaiById(req.params.uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importPegawai(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await PegawaiService.importPegawai(req.author.faskesUuid ?? faskes_uuid_dummy, req.file.path);
      await deleteFile(req.file.path);
      res.status(200).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportPegawai(req, res, nextFunction) {
    try {
      const result = await PegawaiService.exportPegawai(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deletePegawai(req, res, nextFunction) {
    try {
      const result = await PegawaiService.deletePegawai(req.params.uuid);
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
