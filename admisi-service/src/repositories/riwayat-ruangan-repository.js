import {Context} from "../middlewares/context.js";
import {CTX_AUTHOR} from "../constant/context-constant.js";
import {
    RiwayatRuanganModel
} from "@opensimrs/model-sdk/pelayanan";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export default class RiwayatRuanganRepository{
    static async addHistory(data, transaction = null) {
        const trx = transaction || await sequelizeInstance.transaction();
        try {
            const user = Context.get(CTX_AUTHOR);
            const history = await RiwayatRuanganModel.create({
                ...data,
                faskesUuid: user.faskesUuid
            }, { transaction: trx });

            if (!transaction) await trx.commit();

            return history;
        } catch (error) {
            if (!transaction) await trx.rollback();
            throw error;
        }
    }

}