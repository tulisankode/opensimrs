import StokOpnameService from "../services/stok-opname-service.js";
import successResponse from "../responses/success-response.js";
import BadRequestException from "../errors/bad-request-exception.js";

export default class StokOpnameController {
  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const data = await StokOpnameService.getAll(req.query);
      res
        .status(200)
        .json(
          successResponse(
            "Data berhasil ditampilkan",
            data.data,
            data.pagination
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetail(req, res, nextFunction) {
    try {
      req.query.stok_opname_uuid = req.params.stok_opname_uuid;
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await StokOpnameService.getDetail(req.query);
      res.status(200).json(successResponse("Data berhasil ditampilkan", result.data, result.pagination));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getStockCard(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await StokOpnameService.getStockCard(req.query, req.headers);
      res.status(200).json(successResponse("Data berhasil ditampilkan", result.data, result.pagination));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async create(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.petugas_so = req.author.user_uuid;
      req.body.petugas_pengubah = req.author.user_uuid;
      await StokOpnameService.create(req.body, req.headers);
      res.status(201).json(successResponse("data berhasil ditambahkan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async importStockCard(req, res, nextFunction) {
    try {
      if (!req.file) {
        throw new BadRequestException("File Excel ('file') tidak ditemukan dalam request.");
      }
      const serviceInput = {
        fileBuffer: req.file.buffer,
        originalFilename: req.file.originalname,
        faskes_uuid: req.author.faskesUuid,
        petugas_impor: req.author.username,
        lokasi_stok_uuid: req.body.lokasi_stok_uuid
      };
      const result = await StokOpnameService.importStockCard(serviceInput, req.headers);
      res.status(200).json(successResponse("Data berhasil di import", result));
    } catch (e) {
      nextFunction(e);
    }
  }

  static async deleteItems(req, res, nextFunction) {
    try {
      await StokOpnameService.deleteItems(req.body);
      res.status(200).json(successResponse("data berhasil dihapus"));
    } catch (error) {
      nextFunction(error);
    }
  }
}
