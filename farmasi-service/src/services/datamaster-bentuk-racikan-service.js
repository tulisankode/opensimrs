import ZodValidator from "../validations/zod-validator.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import DataMasterBentukRacikanRepository from "../repositories/datamaster-bentuk-racikan-repository.js";

export default class DatamasterBentukRacikanService {
    static async create(req) {
        let validData = ZodValidator.validate(DatamasterValidation.CREATE_BENTUK_RACIKAN, req);
        return await DataMasterBentukRacikanRepository.create(validData);
    }

    static async getAll(req) {
        ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);
        return await DataMasterBentukRacikanRepository.getAll(req);
    }

    static update(req) {
        let validData = ZodValidator.validate(DatamasterValidation.UPDATE_BENTUK_RACIKAN, req);
        return DataMasterBentukRacikanRepository.update(validData);
    }

    static delete(req) {
        let validData = ZodValidator.validate(DatamasterValidation.DELETE_SATUAN, req);
        return DataMasterBentukRacikanRepository.delete(validData);
    }
}