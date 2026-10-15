import ZodValidator from "../validations/zod-validator.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import DatamasterBentukSediaanRepository from "../repositories/datamaster-bentuk-sediaan-repository.js";
import ExcelMapper from "../helpers/excel-mapper.js";
import DataMasterSatuanRepository from "../repositories/datamaster-satuan-repository.js";

export default class DatamasterBentukSediaanService {
    static async create(req) {
        let validData = ZodValidator.validate(DatamasterValidation.CREATE_SATUAN, req);
        validData.code = req.code.toUpperCase();
        return await DatamasterBentukSediaanRepository.create(validData);
    }

    static async getAll(req) {
        ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);
        return await DatamasterBentukSediaanRepository.getAll(req);
    }

    static update(req) {
        let validData = ZodValidator.validate(DatamasterValidation.UPDATE_SATUAN, req);
        return DatamasterBentukSediaanRepository.update(validData);
    }

    static delete(req) {
        let validData = ZodValidator.validate(DatamasterValidation.DELETE_SATUAN, req);
        return DatamasterBentukSediaanRepository.delete(validData);
    }

    static import(req){
        const data = ExcelMapper.mapDatamasterBentukSediaan(req.data, req.faskes_uuid);

        return DatamasterBentukSediaanRepository.bulkCreate(data);
    }
}