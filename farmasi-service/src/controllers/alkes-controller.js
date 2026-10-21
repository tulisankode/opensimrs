import successResponse from "../responses/success-response.js";
import AlkesService from "../services/alkes-service.js";

export default class AlkesController {
  static async orderAlkes(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.petugas_order = req.author.username;

      const result = await AlkesService.orderAlkes(req.body);

      res.status(200).json(successResponse("Data berhasil disimpan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async addAlkesItems(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.order_alkes_uuid = req.params.uuid;
      const result = await AlkesService.addAlkesItems(req.body);
      res
        .status(200)
        .json(successResponse("data berhasil ditambahkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async deleteAlkesItem(req, res, nextFunction) {
    try {
      await AlkesService.deleteAlkes({ ...req.params, faskes_uuid: req.author.faskesUuid });
      res.status(200).json(successResponse("Data berhasil dihapus"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getByUuid(req, res, nextFunction) {
    try {
      req.query.uuid = req.params.uuid;
      req.query.user_uuid = req.user_uuid ?? null;
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await AlkesService.getByUuid(req.query);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateAlkes(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      await AlkesService.updateAlkes(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateAlkesItem(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      await AlkesService.updateAlkesItem(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getOrderByRekamMedis(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await AlkesService.getOrderBySomeUuid(req.query);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async batalOrder(req, res, nextFunction) {
    try {
      req.body.petugas_pembatalan = req.author.username;
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.token = req.headers.authorization;
      await AlkesService.batalOrder(req.body);
      res.status(200).json(successResponse("data berhasil dibatalkan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateVerifikasi(req, res, nextFunction) {
    try {
      const data = req.body;
      const author = req.author;
      const token = req.headers.authorization;

      const result = await AlkesService.updateVerifikasi(data, author, token);

      res.status(200).json(successResponse("Data berhasil diupdate", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateSiapDiserahkan(req, res, nextFunction) {
    try {
      req.body.petugas_penyiapan_obat = req.author.username;
      req.body.faskes_uuid = req.author.faskesUuid;
      await AlkesService.updateSiapDiserahkan(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateDiserahkan(req, res, nextFunction) {
    try {
      req.body.petugas_pemberi = req.author.username;
      req.body.faskes_uuid = req.author.faskesUuid;
      await AlkesService.updateDiserahkan(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async batalSiapDiserahkan(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await AlkesService.batalSiapDiserahkan(req.body);
      res.status(200).json(successResponse("data berhasil dibatalkan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateLokasiStok(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await AlkesService.updateLokasiStok(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllForFarmacy(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await AlkesService.getAllForFarmacy(req.body);
      res
        .status(200)
        .json(successResponse("data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async updateJenisStokItem(req, res, nextFunction) {
    try {
      req.body.uuid = req.params.uuid;
      req.body.faskes_uuid = req.author.faskesUuid;
      await AlkesService.updateJenisItem(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }
}
