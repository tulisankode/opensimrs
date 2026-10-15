import ZodValidator from "../validations/zod-validator.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import DataMasterLokasiStokRepository from "../repositories/datamaster-lokasi-stok-repository.js";
import ExcelMapper from "../helpers/excel-mapper.js";

export default class DatamasterLokasiStokService {
  static async create(req) {
    let validData = ZodValidator.validate(
      DatamasterValidation.CREATE_LOKASI_STOK,
      req
    );
    if (req.jenis_lokasi === "depo") {
      req.default_tujuan_order_permintaan =
        req.default_tujuan_order_permintaan.join("");
    }
    req.code = req.code.toUpperCase();
    return await DataMasterLokasiStokRepository.create(req);
  }

  static async getAll(req) {
    ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);
    const result = await DataMasterLokasiStokRepository.getAll(req);
    result.data = result.data.map((item) => ({
      ...item,
      default_tujuan_order_permintaan:
        item.default_tujuan_order_permintaan &&
        item.default_tujuan_order_permintaan.trim() !== ""
          ? item.default_tujuan_order_permintaan.split("")
          : item.default_tujuan_order_permintaan,
    }));
    return result;
  }

  static update(req) {
    let validData = ZodValidator.validate(
      DatamasterValidation.UPDATE_LOKASI_STOK,
      req
    );
    if (req.jenis_lokasi === "depo") {
      req.default_tujuan_order_permintaan =
        req.default_tujuan_order_permintaan.join("");
    }
    return DataMasterLokasiStokRepository.update(req);
  }

  static delete(req) {
    let validData = ZodValidator.validate(
      DatamasterValidation.DELETE_SATUAN,
      req
    );
    return DataMasterLokasiStokRepository.delete(validData);
  }

  static import(req) {
    const data = ExcelMapper.mapDatamasterLokasiStok(req.data, req.faskes_uuid);

    return DataMasterLokasiStokRepository.bulkCreate(data);
  }

  static async export(req) {
    ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);

    const result = await DataMasterLokasiStokRepository.getAll(req);

    const mapping = ["RI", "RJ", "IGD", "FISIO"];
    for (let i = 0; i < result.data.length; i++) {
      result.data[i].jenis_lokasi =
        result.data[i].jenis_lokasi === "depo" ? "Depo" : "Gudang";
      if (result.data[i].default_tujuan_order_permintaan.length > 1) {
        result.data[i].default_tujuan_order_permintaan = result.data[
          i
        ].default_tujuan_order_permintaan
          .split("")
          .map((num) => mapping[parseInt(num, 10)])
          .join(",");
      }
    }

    return result;
  }
}
