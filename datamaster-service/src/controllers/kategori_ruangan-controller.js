import KategoriRuanganService from "../services/kategori_ruangan-service.js";
import deleteFile from "../helpers/delete-file.js";
import { validateExcel } from "../helpers/helper.js";

export default class KategoriRuanganController {
  static async createKategoriRuangan(req, res, nextFunction) {
    try {
      const body = { ...req.body, faskes_uuid: req.author.faskesUuid };
      const result = await KategoriRuanganService.createKategoriRuangan(body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateKategoriRuangan(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await KategoriRuanganService.updateKategoriRuangan(
        req.params.uuid,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllKategoriRuangan(req, res, nextFunction) {
    try {
      const page = req.query.page;
      const pageSize = req.query.limit;
      const name = req.query.name;
      const faskes_uuid = req.author.faskesUuid;
      const order_by = req.query.order_by ?? "DESC";
      const result = await KategoriRuanganService.getAllKategoriRuangan(name, page, pageSize, faskes_uuid, order_by);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importKategoriRuangan(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await KategoriRuanganService.importKategoriRuangan(req.author.faskesUuid, req.file.path);
      await deleteFile(req.file.path);
      res.status(201).json(result);
    } catch (error) {
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
      nextFunction(error);
    }
  }

  static async exportKategoriRuangan(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid;
      const result = await KategoriRuanganService.exportKategoriRuangan(faskes_uuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllKategoriRuanganAktif(req, res, nextFunction) {
    try {
      const offset = req.query.offset || 1;
      const limit = req.query.limit || 10;
      const order_by = req.query.order_by || "DESC";
      const search = req.query.search || null;
      const faskes_uuid = req.author.faskesUuid ?? null;
      const status = req.is_actice || true;
      const result = await KategoriRuanganService.getAllKategoriRuanganAktif({limit, offset, order_by, search, faskes_uuid, status});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getKategoriRuanganById(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid;
      const uuid = req.params.uuid;
      const result = await KategoriRuanganService.getKategoriRuanganById({faskes_uuid, uuid});
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteKategoriRuangan(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid;
      const uuid = req.params.uuid;
      const result = await KategoriRuanganService.deleteKategoriRuangan({faskes_uuid, uuid});
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
