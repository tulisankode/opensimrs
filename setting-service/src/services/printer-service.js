import FaskesRepository from "../repositories/faskes-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import PrinterRepository from "../repositories/printer-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import PrinterValidation from "../validations/printer-validation.js";
import {toEpochDate} from "../helpers/date-helper.js";
import Utils from "../helpers/utils.js";

export default class PrinterService {
    static async findByUuid(uuid) {
        const faskes = await FaskesRepository.findByUuid(uuid);
        if(faskes === null) throw new NotfoundException('faskes tidak ditemukan');

        let data = await PrinterRepository.findByFaskesUuid(uuid);

        if(data === null) {
            data = await PrinterRepository.create({faskesUuid : uuid})
        }

        return Utils.camelToSnakeObject(data.dataValues);
    }

    static async update(req) {
        const validData = ZodValidator.validate(PrinterValidation.UPDATE, req);
        validData.updatedAt = toEpochDate(new Date());
        const affectedRow = await PrinterRepository.update(validData);
        if(affectedRow === 0) throw new NotfoundException('gagal mengupdate printer, data tidak ditemukan');
        return { message: `berhasil mengupdate ${affectedRow} printer` };
    }
}