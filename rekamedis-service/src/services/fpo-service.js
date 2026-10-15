import ZodValidator from "../validations/zod-validator.js";
import FpoValidation from "../validations/fpo-validation.js";
import FpoRepository from "../repositories/fpo-repository.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import BadRequestException from "../errors/bad-request-exception.js";
import NotfoundException from "../errors/notfound-exception.js";

export default class FpoService {
    static async get(req){
        await ZodValidator.validate(FpoValidation.GET, req);

        const result = await FpoRepository.get(req);

        // if (result.length === 0) {
        //     throw new NotfoundException("data tidak ditemukan");
        // }

        return result;
    }

    static async insert(req){
        const transaction = await sequelizeInstance.transaction();

        await ZodValidator.validate(FpoValidation.INSERT, req);

        const sisaQty = await FpoRepository.getSisaQtyOrder(req.prescription_item_uuid);
        if(sisaQty?.sisa_qty_order <= 0){
            throw new BadRequestException("Pemberian obat gagal. Stok obat tidak mencukupi");
        }

        try {
            const result = await FpoRepository.insert(req, transaction);
            await FpoRepository.reduceItem(req, transaction);

            await transaction.commit();
            return result;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async update(req){
        const transaction = await sequelizeInstance.transaction();

        try {

            await ZodValidator.validate(FpoValidation.UPDATE, req);
            const result = await FpoRepository.update(req, transaction);

            if (result === 0) {
                throw new NotfoundException("Data tidak ditemukan");
            }

            await transaction.commit();
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }
}