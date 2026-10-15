import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {FaskesModel} from "@opensimrs/model-sdk/datamaster";
import {FaskesProfilesModel} from "@opensimrs/model-sdk/setting";

export default class FaskesRepository {
    static async getByUuid(uuid) {
        return await FaskesModel.findOne({
            where: {
                uuid: uuid
            }
        });
    }

    static async getProfile(faskes_uuid){
        return await sequelizeInstance.transaction(async tr => {
            return await FaskesProfilesModel.findOne({
                where: {
                    faskesUuid: faskes_uuid
                },
                transaction: tr
            });
        });
    }

}