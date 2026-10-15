import ZodValidator from "../validations/zod-validator.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import DataMasterSatuanRepository from "../repositories/datamaster-satuan-repository.js";
import ExcelMapper from "../helpers/excel-mapper.js";

export default class DatamasterSatuanService {
  static async create(req) {
    ZodValidator.validate(DatamasterValidation.CREATE_SATUAN, req);
    req.code = req.code.toUpperCase();
    return await DataMasterSatuanRepository.create(req);
  }

  static async getAll(req) {
    ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);
    return await DataMasterSatuanRepository.getAll(req);
  }

  static update(req) {
    ZodValidator.validate(DatamasterValidation.UPDATE_SATUAN, req);
    return DataMasterSatuanRepository.update(req);
  }

  static delete(req) {
    let validData = ZodValidator.validate(
      DatamasterValidation.DELETE_SATUAN,
      req
    );
    return DataMasterSatuanRepository.delete(validData);
  }

  static import(req) {
    const data = ExcelMapper.mapDatamasterSatuan(req.data, req.faskes_uuid);

    return DataMasterSatuanRepository.bulkCreate(data);
  }
}
