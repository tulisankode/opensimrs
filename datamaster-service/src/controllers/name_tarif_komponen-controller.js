import deleteFile from "../helpers/delete-file.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import NameTarifKomponenService from "../services/name_tarif_komponen-service.js";
import { validateExcel } from "../helpers/helper.js";

export default class NameTarifKomponenController {
  static async createNameTarifKomponen(req, res, nextFunction) {
    try {
      // const faskes_uuid = res.locals.jwtData.faskesUuid;
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      const result = await NameTarifKomponenService.createNameTarifKomponen(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateNameTarifKomponen(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await NameTarifKomponenService.updateNameTarifKomponen(req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllNameTarifKomponen(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;

      const result = await NameTarifKomponenService.getAllNameTarifKomponen(
        name,
        page,
        pageSize, req.author.faskesUuid
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllNameTarifKomponenAktif(req, res, nextFunction) {
    try {
      const result = await NameTarifKomponenService.getAllNameTarifKomponenAktif(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importNameTarifKomponen(req, res, nextFunction) {
    try {
     validateExcel(req.file);
      const result = await NameTarifKomponenService.importNameTarifKomponen(
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

  static async exportNameTarifKomponen(req, res, nextFunction) {
    try {
      const result = await NameTarifKomponenService.exportNameTarifKomponen();
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getNameTarifKomponenById(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid;
      const faskes_uuid = req.author.faskesUuid;
      const result = await NameTarifKomponenService.getNameTarifKomponenById({uuid, faskes_uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteNameTarifKomponen(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid;
      const faskes_uuid = req.author.faskesUuid;
      const result = await NameTarifKomponenService.deleteNameTarifKomponen({uuid, faskes_uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
