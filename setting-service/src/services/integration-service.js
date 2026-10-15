import IntegrationRepository from "../repositories/integration-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import ZodValidator from "../validations/zod-validator.js";
import {toEpochDate} from "../helpers/date-helper.js";
import IntegrationValidation from "../validations/integration-validation.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import Utils from "../helpers/utils.js";

export default class IntegrationService {
    static async findByUuid(uuid) {
        const faskes = await FaskesRepository.findByUuid(uuid);
        if(faskes === null) throw new NotfoundException('faskes tidak ditemukan');

        let data = await IntegrationRepository.findByFaskesUuid(uuid);
        if(data === null) {
            data = await IntegrationRepository.create({faskesUuid : uuid})
        }

        return Utils.camelToSnakeObject(data.dataValues, ['PPK']);
    }

    static async updateVclaim(req) {
        const validData = ZodValidator.validate(IntegrationValidation.UPDATEVCLAIM, Utils.snakeToCamelObject(req));
        validData.updatedAt = toEpochDate(new Date());
        const affectedRow = await IntegrationRepository.update(validData);
        if(affectedRow === 0) throw new NotfoundException('gagal mengupdate integrasi, data tidak ditemukan');
        return { message: `berhasil mengupdate ${affectedRow} integrasi` };
    }

    static async updateOther(req) {
        const validData = ZodValidator.validate(IntegrationValidation.UPDATEOTHER, Utils.snakeToCamelObject(req));
        validData.updatedAt = toEpochDate(new Date());
        const affectedRow = await IntegrationRepository.update(validData);
        if(affectedRow === 0) throw new NotfoundException('gagal mengupdate integrasi, data tidak ditemukan');
        return { message: `berhasil mengupdate ${affectedRow} integrasi` };
    }

    static async updateSatuSehat(req) {
        const validData = ZodValidator.validate(IntegrationValidation.UPDATESATUSEHAT, req);
        validData.updatedAt = toEpochDate(new Date());
        const affectedRow = await IntegrationRepository.update(Utils.snakeToCamelObject(validData));
        if(affectedRow === 0) throw new NotfoundException('gagal mengupdate integrasi, data tidak ditemukan');
        return { message: `berhasil mengupdate ${affectedRow} integrasi` };
    }
}