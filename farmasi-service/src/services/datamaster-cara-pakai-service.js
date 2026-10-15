import ZodValidator from "../validations/zod-validator.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import DataMasterCaraPakaiRepository from "../repositories/datamaster-cara-pakai-repository.js";
import ExcelMapper from "../helpers/excel-mapper.js";
import DataMasterSatuanRepository from "../repositories/datamaster-satuan-repository.js";

export default class DatamasterCaraPakaiService {
    static async create(req) {
        let validData = ZodValidator.validate(DatamasterValidation.CREATE_CARA_PAKAI, req);
        validData.code = req.code.toUpperCase();
        return await DataMasterCaraPakaiRepository.create(validData);
    }

    static async getAll(req) {
        ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);
        return await DataMasterCaraPakaiRepository.getAll(req);
    }

    static update(req) {
        let validData = ZodValidator.validate(DatamasterValidation.UPDATE_CARA_PAKAI, req);
        return DataMasterCaraPakaiRepository.update(validData);
    }

    static delete(req) {
        let validData = ZodValidator.validate(DatamasterValidation.DELETE_SATUAN, req);
        return DataMasterCaraPakaiRepository.delete(validData);
    }

    static import(req){
        const data = ExcelMapper.mapDatamasterCaraPakai(req.data, req.faskes_uuid);

        return DataMasterCaraPakaiRepository.bulkCreate(data);
    }
}