import {
    PatientFamilyModel
} from "@opensimrs/model-sdk/admisi";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {Context} from "../middlewares/context.js";
import {CTX_AUTHOR} from "../constant/context-constant.js";

export default class PatientFamilyRepository {
    static async create(data, transaction = null) {
        let t = transaction;
        console.log("Creating Patient Family: ", data);
        try {
            const user = Context.get(CTX_AUTHOR);
            t = t || await sequelizeInstance.transaction();
            const patientFamily = await PatientFamilyModel.create({
                ...data,
                faskesUuid: user.faskesUuid
            }, {transaction: t, returning: true});

            if (!transaction) await t.commit();
            return patientFamily;
        } catch (error) {
            if (t && !transaction) await t.rollback();
            throw error;
        }
    }

}