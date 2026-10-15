import successResponse from "../responses/success-response.js";
import PermintaanUnitService from "../services/permintaan-unit-service.js";

export default class PermintaanUnitController {
  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const data = await PermintaanUnitService.getAll(req.query, req.headers);
      res.status(200).json(successResponse("Data berhasil ditampilkan", data.data, data.pagination));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetail(req, res, nextFunction) {
    try {
      req.query.uuid = req.params.uuid;
      const data = await PermintaanUnitService.getDetail(req.query, req.headers);
      res.status(200).json(successResponse("Data berhasil ditampilkan", data));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async tolakPermintaan(req, res, nextFunction) {
    try {
      const options = {
        uuid: req.params.uuid,
        alasan_batal: req.body.alasan_batal,
        petugas_batal_tolak: req.author.username
      };
      const result = await PermintaanUnitService.tolakPermintaan(options);
      res.status(200).json(successResponse("Data berhasil dibatalkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async verifikasiPermintaan(req, res, nextFunction) {
    try {
      const headers = req.headers;
      const options = {
        uuid: req.params.uuid,
        item: req.body.item,
        petugas_uuid: req.author.user_uuid,
        faskes_uuid: req.author.faskesUuid
      };
      const result = await PermintaanUnitService.verifikasiPermintaan(options, headers);
      res.status(200).json(successResponse("Data berhasil diverifikasi", result, null));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async kirimPermintaan(req, res, nextFunction) {
    try {
      const headers = req.headers;
      const options = {
        ...req.body, 
            uuid: req.params.uuid,
            faskes_uuid: req.author.faskesUuid,
            petugas_uuid: req.author.user_uuid || req.author.uuid,
      };
      await PermintaanUnitService.kirimPermintaan(options, headers);
      res.status(200).json(successResponse("Data berhasil dikirim"));
    } catch (error) {
      nextFunction(error);
    }
  }
}
