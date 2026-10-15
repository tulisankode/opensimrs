import {
  messageErrorDataNotFound,
  messageErrorEdit,
  messageSuccessEdit,
  messageSuccessShow,
} from "../helpers/message.js";
import AntrianRawatJalanRepository from "../repositories/antrian_rj-repository.js";
import AntrianRawatJalanValidation from "../validations/antrian_rajal-validation.js";
import ZodValidator from "../validations/zod-validator.js";

export default class AntrianRawatJalanService {
    static async updateStatus(uuid, data) {
        const validData = ZodValidator.validate(AntrianRawatJalanValidation.UPDATE_STATUS_ANTRIAN, data);
        if (!validData) throw new Error("Data tidak Valid");
        return await AntrianRawatJalanRepository.updateStatusRajal(uuid, validData);

    }

    static async mulaiPeriksa(rawatJalanUuid) {
        return await AntrianRawatJalanRepository.mulaiPeriksa(rawatJalanUuid);
    }

    static async konteksPetugas(userUuid) {
        return await AntrianRawatJalanRepository.konteksPetugas(userUuid);
    }

    static async getAntrian(args) {
        return await AntrianRawatJalanRepository.getAntrian({ status_panggilan: args.status_panggilan, pelayanan: args.pelayanan });
    }
}
