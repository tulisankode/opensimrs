import successResponse from "../response/success-response.js";
import RujukanService from "../services/rujukan-service.js";

export default class RujukanController {
  static async tandai(req, res, next) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await RujukanService.tandai(
        req.params.uuid,
        req.body,
        req.headers.authorization
      );
      return res
        .status(200)
        .json(successResponse("Item berhasil ditandai dirujuk"));
    } catch (error) {
      next(error);
    }
  }

  static async batal(req, res, next) {
    try {
      await RujukanService.batal(req.params.uuid, req.author.faskesUuid);
      return res
        .status(200)
        .json(successResponse("Penandaan rujukan berhasil dibatalkan"));
    } catch (error) {
      next(error);
    }
  }

  static async kirim(req, res, next) {
    try {
      await RujukanService.kirim(req.params.uuid, req.author.faskesUuid);
      return res
        .status(200)
        .json(successResponse("Item rujukan berhasil ditandai terkirim"));
    } catch (error) {
      next(error);
    }
  }

  static async unggahBerkas(req, res, next) {
    try {
      await RujukanService.unggahBerkas(
        req.params.uuid,
        req.author.faskesUuid,
        req.file
      );
      return res
        .status(201)
        .json(successResponse("Berkas hasil rujukan berhasil diunggah"));
    } catch (error) {
      next(error);
    }
  }

  static async unduhBerkas(req, res, next) {
    try {
      const berkas = await RujukanService.unduhBerkas(
        req.params.uuid,
        req.author.faskesUuid
      );
      return res
        .status(200)
        .json(successResponse("Berhasil mendapatkan berkas rujukan", berkas));
    } catch (error) {
      next(error);
    }
  }

  static async hapusBerkas(req, res, next) {
    try {
      await RujukanService.hapusBerkas(req.params.uuid, req.author.faskesUuid);
      return res
        .status(200)
        .json(successResponse("Berkas hasil rujukan berhasil dihapus"));
    } catch (error) {
      next(error);
    }
  }
}
