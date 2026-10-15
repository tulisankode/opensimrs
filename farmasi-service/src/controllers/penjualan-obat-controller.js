import successResponse from "../responses/success-response.js";
import PenjualanObatService from "../services/penjualan-obat-service.js";

export default class PenjualanObatController {
  static async create(req, res, nextFunction) {
    try {
      const author = req.author;
      const data = req.body;
      const result = await PenjualanObatService.create(data, author);

      res.status(200).json(successResponse(`Data berhasil disimpan`, result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllWithoutPagination(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await PenjualanObatService.getAllWithoutPagination(
        req.query
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async batalOtc(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      const { alasan_batal } = req.body;
      const author = req.author;
      const token = req.headers.authorization;

      if (!alasan_batal) {
        throw new BadRequestException(
          "Properti 'alasan_batal' wajib diisi dalam body request."
        );
      }

      const data = {
        uuid: uuid,
        alasan_batal: alasan_batal,
      };

      const result = await PenjualanObatService.batalOtc(data, author, token);

      res
        .status(200)
        .json(successResponse("Penjualan obat berhasil dibatalkan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;

      const result = await PenjualanObatService.getAll(req.query);
      res
        .status(200)
        .json(
          successResponse(
            "Data berhasil ditampilkan",
            result.data,
            result.pagination
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetail(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      req.query.uuid = uuid;
      req.query.faskes_uuid = req.author.faskesUuid;

      const result = await PenjualanObatService.getByUuid(req.query);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getCode(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await PenjualanObatService.generateCode(req.query);
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }
}
