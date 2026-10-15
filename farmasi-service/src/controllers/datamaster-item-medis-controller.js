import DatamasterItemMedisService from "../services/datamaster-item-medis-service.js";
import successResponse from "../responses/success-response.js";
import Utils from "../helpers/utils.js";
import DatamasterSatuanService from "../services/datamaster-satuan-service.js";
import BadRequestException from "../errors/bad-request-exception.js";

export default class DatamasterItemMedisController {
  static async create(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      await DatamasterItemMedisService.create(req.body);
      res.status(201).json(successResponse("Data berhasil disimpan"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async update(req, res, nextFunction) {
    try {
      req.body.faskes_uuid = req.author.faskesUuid;
      req.body.uuid = req.params.uuid;
      await DatamasterItemMedisService.update(req.body);
      res.status(200).json(successResponse("data berhasil diupdate"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAll(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      req.query.jenis_stok_uuides = req.body.jenis_stok_uuides;
      const result = await DatamasterItemMedisService.getAll(req.query);
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

  static async getItemMedisJenisStok(req, res, nextFunction){
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await DatamasterItemMedisService.getItemMedisJenisStok(
        req.query
      );
      res
        .status(200)
        .json(
          successResponse(
            "Data berhasil ditampilkan",
            result
          )
        );
    } catch (error) {
      nextFunction(error);
    }
  }

  static async delete(req, res, nextFunction) {
    try {
      const { uuid } = req.params;
      req.body.uuid = uuid;
      await DatamasterItemMedisService.delete(req.body);
      res.status(200).json(successResponse("Data berhasil dihapus"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getConversions(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      req.query.item_medis_uuid = req.params.uuid;
      const data = await DatamasterItemMedisService.getConversions(req.query);
      res.status(200).json(successResponse("Data berhasil ditampilkan", data));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAllConversions(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const data = await DatamasterItemMedisService.getAllConversions(
        req.query
      );
      res.status(200).json(successResponse("Data berhasil ditampilkan", data));
    }
    catch (error) {
      nextFunction(error);
    }
  }

  static async getAllWithoutPagination(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await DatamasterItemMedisService.getAllWithoutPagination(
        req.query
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async getAvailableJenisStok(req, res, nextFunction) {
    try {
      const { item_medis_jenis_stok_uuid } = req.params;
      const { lokasi_stok_uuid } = req.query;
      const faskesUuid = req.author.faskesUuid;
      // lokasi_stok_uuid opsional (tanpa lokasi: stok semua lokasi)

      const params = {
        item_medis_jenis_stok_uuid,
        lokasi_stok_uuid,
      };

      const result = await DatamasterItemMedisService.getAvailableJenisStok(
        params,
        faskesUuid
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async import(req, res, nextFunction) {
    try {
      req.body.data_item_medis = Utils.parseExcelToJSON(req);
      req.body.faskes_uuid = req.author.faskesUuid;

      req.body.data_conversion = Utils.parseExcelToJSON(req, 1);
      const result = await DatamasterItemMedisService.import(req.body);

      res.status(200).json(successResponse("data berhasil diimport"));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async export(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      req.query.jenis_stok_uuides = req.body.jenis_stok_uuides;
      const result = await DatamasterItemMedisService.export(req.query);
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

  static async getForPengadaan(req, res, nextFunction) {
    try {
      req.query.faskes_uuid = req.author.faskesUuid;
      const result = await DatamasterItemMedisService.getForPengadaan(
        req.query
      );
      res
        .status(200)
        .json(successResponse("Data berhasil ditampilkan", result));
    } catch (error) {
      nextFunction(error);
    }
  }
}
