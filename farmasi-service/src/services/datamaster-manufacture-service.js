import ZodValidator from "../validations/zod-validator.js";
import DatamasterValidation from "../validations/datamaster-validation.js";
import DataMasterManufactureRepository from "../repositories/datamaster-manufacture-repository.js";
import ExcelMapper from "../helpers/excel-mapper.js";
import BadRequestException from "../errors/bad-request-exception.js";

export default class DatamasterManufactureService {
    static async create(req) {
        let validData = ZodValidator.validate(DatamasterValidation.CREATE_MANUFACTURE, req);
        validData.code = req.code.toUpperCase();
        return await DataMasterManufactureRepository.create(validData);
    }

    static async getAll(req) {
        ZodValidator.validate(DatamasterValidation.GET_ALL_SATUAN, req);
        return await DataMasterManufactureRepository.getAll(req);
    }

    static async update(req) {
        let validData = ZodValidator.validate(DatamasterValidation.UPDATE_MANUFACTURE, req);
        return await DataMasterManufactureRepository.update(validData);
    }

    static async delete(req) {
        let validData = ZodValidator.validate(DatamasterValidation.DELETE_SATUAN, req);
        return await DataMasterManufactureRepository.delete(validData);
    }

    static async import(req){
        const data = ExcelMapper.mapDatamasterManufacture(req.data, req.faskes_uuid);

        return DataMasterManufactureRepository.bulkCreate(data);
    }

    static async export(req){
        const result = await DataMasterManufactureRepository.getAll(req);
        if (result.data.length === 0) {
            throw new BadRequestException("Data not found");
        }

        result.data.forEach((item, index) => {
            item.demografi = `${item.provinsi_code}, ${item.kabupaten_code}, ${item.kecamatan_code}, ${item.kelurahan_code}, ${item.kode_pos}`
        })

        return result;
    }
}