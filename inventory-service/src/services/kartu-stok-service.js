import ItemMedisJenisStokRepository from "../repositories/item-medis-jenis-stok-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import KartuStokValidation from "../validations/kartu-stok-validation.js";
import KartuStokMutasiMapper from "../mappers/kartu-stok-mutasi-mapper.js";

export default class KartuStokService {
    static async getAll(req) {
        ZodValidator.validate(KartuStokValidation.GET_ALL, req);
        const { pagination, data: rawData } = await ItemMedisJenisStokRepository.getForKartuStok(req);
        const transformedData = rawData?.map(item => KartuStokMutasiMapper.toKartuStokListDTO(item, req.lokasi_stok_uuid));
        return { pagination: pagination, data: transformedData };
    }
}