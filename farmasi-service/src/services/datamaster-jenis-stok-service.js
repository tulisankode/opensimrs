import ZodValidator from "../validations/zod-validator.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import DataMasterJenisStokRepository from "../repositories/datamaster-jenis-stok-repository.js";
import ExcelMapper from "../helpers/excel-mapper.js";
import DataMasterSatuanRepository from "../repositories/datamaster-satuan-repository.js";

export default class DatamasterJenisStokService {
    static async create(req) {
        let validData = ZodValidator.validate(DatamasterValidation.CREATE_SATUAN, req);
        validData.code = req.code.toUpperCase();
        return await DataMasterJenisStokRepository.create(validData);
    }

    static async getAll(req) {
        ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);
        return await DataMasterJenisStokRepository.getAll(req);
    }

    static update(req) {
        let validData = ZodValidator.validate(DatamasterValidation.UPDATE_SATUAN, req);
        return DataMasterJenisStokRepository.update(validData);
    }

    static delete(req) {
        let validData = ZodValidator.validate(DatamasterValidation.DELETE_SATUAN, req);
        return DataMasterJenisStokRepository.delete(validData);
    }

    static import(req){
        const data = ExcelMapper.mapDatamasterJenisStok(req.data, req.faskes_uuid);

        return DataMasterJenisStokRepository.bulkCreate(data);
    }
}