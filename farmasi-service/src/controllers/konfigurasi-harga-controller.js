import successResponse from "../responses/success-response.js";
import KonfigurasiHargaService from "../services/konfigurasi-harga-service.js";

export default class KonfigurasiHargaController {
  static async get(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await KonfigurasiHargaService.get(req.body);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getHargaItem(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      const result = await KonfigurasiHargaService.getHargaItem(req.body);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getHargaItemByUuid(req, res, nextFunction) {
    try {
      const result = await KonfigurasiHargaService.getHargaItemByUuid(
        req.params.uuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async update(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.petugas = req.author.username;
      await KonfigurasiHargaService.update(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }
}
