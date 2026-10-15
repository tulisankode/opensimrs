import RuanganService from "../services/ruangan-service.js";
import deleteFile from "../helpers/delete-file.js";
import { validateExcel } from "../helpers/helper.js";

export default class RuanganController {
  static async createRuangan(req, res, nextFunction) {
    try {
      const body = {...req.body, faskes_uuid: req.author.faskesUuid};
      const result = await RuanganService.createRuangan(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateRuangan(req, res, nextFunction) {
    try {
      const result = await RuanganService.updateRuangan(req.params.uuid, req.body);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllRuangan(req, res, nextFunction) {
    try {
      const page = req.query.page ?? 1;
      const pageSize = req.query.limit ?? 10;
      const name = req.query.name ??  null;
      const kategori_ruangan_uuid = req.query.kategori_ruangan_uuid ?? null;
      const kelas_ruangan = req.query.kelas_ruangan ?? null;
      const faskes_uuid = req.author.faskesUuid ?? null;
      const order_by = req.query.order_by ?? "DESC";
      const result = await RuanganService.getAllRuangan(name, kategori_ruangan_uuid, kelas_ruangan, page, pageSize, faskes_uuid, order_by);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importRuangan(req, res, nextFunction) {
    try {
     validateExcel(req.file);
      const result = await RuanganService.importRuangan(req.author.faskesUuid, req.file.path);
      await deleteFile(req.file.path);
      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportRuangan(req, res, nextFunction) {
    try {
      const data = await RuanganService.exportRuangan(req.author.faskesUuid);
      res.status(200).json(data);
    } catch (error) {
      console.log(error);
      nextFunction(error);
    }
  }

  static async getAllRuanganAktif(req, res, nextFunction) {
    try {
      const ruanganList = await RuanganService.getAllRuanganAktif(req.author.faskesUuid);
      res.status(200).json(ruanganList);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getRuanganById(req, res, nextFunction) {
    try {
      const ruangan = await RuanganService.getRuanganById(req.params.uuid);
      res.status(200).json(ruangan);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteRuangan(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid ?? null;
      const uuid = req.params.uuid;
      const ruangan = await RuanganService.deleteRuangan({faskes_uuid, uuid});
      res.status(200).json(ruangan);
    } catch (error) {
      nextFunction(error);
    }
  }
}
