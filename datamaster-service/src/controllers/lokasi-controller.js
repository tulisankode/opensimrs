import LokasiService from "../services/lokasi-service.js";
import deleteFile from "../helpers/delete-file.js";
import { faskes_uuid_dummy } from "../helpers/faskes-uuid.js";
import { validateExcel } from "../helpers/helper.js";
import { PartOfLokasiService } from "../services/part-of-lokasi-service.js";

export default class LokasiController {
  static async findByCode(request, response, nextFucntion) {
    try {
      const { code } = request.params;
      const faskes_uuid = request.author.faskesUuid;
      const result = await LokasiService.findByCode({ code, faskes_uuid });
      response.status(200).json(result);
    } catch (error) {
      nextFucntion(error);
    }
  }

  static async createLokasi(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await LokasiService.createLokasi(req.body);
      res.status(201).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} request - express request
   * @param {Response} response - express Response
   * @param {import("express").NextFunction} nextFunction - express nextFunction
   */
  static async findAllIncludePartOf(request, response, nextFunction) {
    try {
      const faskes_uuid = request.author.faskesUuid;
      const limit = request.query.limit ?? 10;
      const offset = request.query.offset ?? 0;
      const search = request.query.search ?? "";
      const order_by = request.query.order_by ?? "DESC";
      const result = await LokasiService.findAllIncludePartOf({
        faskes_uuid,
        limit,
        offset,
        search,
        order_by,
      });
      response.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  /**
   *
   * @param {Request} req
   * @param {Response} res
   * @param {import("express").NextFunction} nextFunction
   */
  static async findAllPartOf(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid || null;
      const limit = req.query.limit || 10;
      const offset = req.query.offset || 1;
      const order_by = req.query.order_by || "DESC";
      const name = req.query.name || null;
      const result = await LokasiService.findAllPartOf({
        faskes_uuid,
        limit,
        offset,
        order_by,
        name,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateLokasi(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.uuid = req.params.uuid;
      let result;
      if (req.body?.location_type == "Site") {
        result = await LokasiService.updateLokasi(req.body);
      } else {
        result = await PartOfLokasiService.update(req.body);
      }
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importLokasi(req, res, nextFunction) {
    try {
      validateExcel(req.file);
      const result = await LokasiService.importLokasi(
        req.author.faskesUuid,
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

  static async exportLokasi(req, res, nextFunction) {
    try {
      const result = await LokasiService.exportLokasi(req.author.faskesUuid);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllLokasi(req, res, nextFunction) {
    try {
      const offset = parseInt(req.query.offset) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const order_by = req.query.order_by ?? "DESC";
      const faskes_uuid = req.author.faskesUuid;
      const name = req.query.search ?? null;
      const result = await LokasiService.getAllLokasi({
        limit,
        offset,
        order_by,
        faskes_uuid,
        name,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllLokasiAktif(req, res, nextFunction) {
    try {
      const offset = parseInt(req.query.offset) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const order_by = req.query.order_by ?? "DESC";
      const faskes_uuid = req.author.faskesUuid;
      const name = req.query.search ?? null;
      const is_active = req.query.is_active ?? true;
      const type = req.query.type ?? null;
      const is_poli = req.query.is_poli ?? null;
      const result = await LokasiService.getAllLokasiAktif({
        limit,
        offset,
        order_by,
        faskes_uuid,
        name,
        is_active,
        type,
        is_poli,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllLokasiPoliAktif(req, res, nextFunction) {
    try {
      const data = req.query;
      data.faskes_uuid = req.author.faskesUuid;
      const result = await LokasiService.getAllLokasiPoliAktif(data);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllLokasiPoliAktifMobile(req, res, nextFunction) {
    try {
      console.log("req ~ ", req.headers);
      const data = req.query;
      data.faskes_uuid = req.headers.faskes_uuid;
      const result = await LokasiService.getAllLokasiPoliAktif(data);
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllLokasiByPartOfUuid(req, res, nextFunction) {
    try {
      const faskes_uuid = req.author.faskesUuid;
      const part_of_uuid = req.params.part_of_uuid ?? null;
      const result = await LokasiService.findAllByPartOfUuid({
        faskes_uuid,
        part_of_uuid,
      });
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getLokasiById(req, res, nextFunction) {
    try {
      const result = await LokasiService.getLokasiById(
        req.params.uuid,
        req.author.faskesUuid
      );
      res.status(200).json(result);
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteLokasi(req, res, nextFunction) {
    try {
      const uuid = req.params.uuid ?? null;
      const faskes_uuid = req.author.faskesUuid ?? null;
      const result = await LokasiService.deleteLokasi({ uuid, faskes_uuid });
      res.status(200).send(result);
    } catch (error) {
      nextFunction(error);
    }
  }
}
