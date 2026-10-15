import TarifService from "../services/tarif-service.js";
import deleteFile from "../helpers/delete-file.js";
import { validateExcel } from "../helpers/helper.js";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse } from "../helpers/generate-message.js";


export default class TarifController {
  static async createTarif(req, res, nextFunction) {
    try {
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      let result = null;
      if (body.jenis_tarif == "Tindakan") {
        result = await TarifService.createTarifTindakan(body);
      } else if(body.jenis_tarif === "Ruangan") {
        result = await TarifService.createTarifRuangan(body);
      }
      else {
        throw new HttpException(
          generateErrorResponse("Gagal", "badrequest", "jenis tarif tidak valid"), HttpStatus.BAD_REQUEST
        )
      }
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateTarif(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      let result = null;
      if (req.body?.jenis_tarif == "Tindakan"){
        if(req.body?.is_mcu) result = await TarifService.updateTarifMcuTrue(req.body);
          else
        result = await TarifService.updateTindakan(req.body);
      }
      else if(req.body?.jenis_tarif == "Ruangan") {
        result = await TarifService.updateRuangan(req.body);
      }
      else {
        throw new HttpException(generateErrorResponse("Gagal", "badrequest", `jenis_tarif tidak boleh kosong`), HttpStatus.BAD_REQUEST);
      }
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllTarif(req, res, nextFunction) {
    try {
      const limit = parseInt(req.query.limit) || 1;
      const offset = parseInt(req.query.offset) || 10;
      const name = req.query.name || null;
      const jenis_tarif = req.query.jenis_tarif || null;
      const faskes_uuid = req.author.faskesUuid || null;
      const is_mcu = req.query.is_mcu || null;
      const order_by = req.query.order_by || "DESC"
      const unit_pelayanan = req.query.unit_pelayanan ?? null;
      const penjamin = req.query.penjamin ?? null;
      const tarifList = await TarifService.findAll({limit, offset, name, jenis_tarif, faskes_uuid, order_by, is_mcu, unit_pelayanan, penjamin});
      res.status(200).json(tarifList);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllTarifAktif(req, res, nextFunction) {
    try {
      const tarifList = await TarifService.getAllTarifAktif(req.author.faskesUuid);
      res.status(200).json(tarifList);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importTarif(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await TarifService.importTarif(req.file.path, req.author.faskesUuid);

      res
        .status(200)
        .json({ result });
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportTarif(req, res, nextFunction) {
    try {
      const data = await TarifService.exportTarif();
      res.status(200).json(data);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getTarifById(req, res, nextFunction) {
    try {
      const tarif = await TarifService.getTarifById(req.params.uuid);
      res.status(200).json(tarif);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteTarif(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid;
      const faskes_uuid = req.author.faskesUuid;
      const tarif = await TarifService.delete({faskes_uuid, uuid});
      res.status(200).send(tarif);
    } catch (error) {
      nextFunction(error);
    }
  }
}
