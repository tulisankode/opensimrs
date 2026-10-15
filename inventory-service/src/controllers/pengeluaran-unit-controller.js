import successResponse from "../responses/success-response.js";
import PengeluaranUnitService from "../services/pengeluaran-unit-service.js";

export default class PengeluaranUnitController {
  static async create(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.petugas_pengeluaran = req.author.username;
      req.body.petugas_pengeluaran_uuid = req.author.user_uuid;

      // Pass headers to service for external API calls if needed
      await PengeluaranUnitService.create(req.body, req.headers);

      res.status(201).json(successResponse("Data berhasil disimpan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAvailableItems(req, res, nextFunction) {
    try {
      // Pass headers (2nd arg) for authorization in external repo
      const data = await PengeluaranUnitService.getAvailableStock(req.query, req.headers);
      res.status(200).json(successResponse("Data berhasil ditampilkan", data));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      const options = { ...req.query, faskes_uuid: req.author.faskesUuid };
      
      // Pass headers (2nd arg)
      const result = await PengeluaranUnitService.getAll(options, req.headers);
      
      res.status(200).json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getDetail(req, res, nextFunction) {
    try {
      req.query.uuid = req.params.uuid;
      const data = await PengeluaranUnitService.getDetail(req.query, req.headers);
      res.status(200).json(successResponse("Data berhasil ditampilkan", data));
    } catch (error) {
      nextFunction(error);
    }
  }
}