import sequelizeInstance from "../configurations/sequelize-instance.js";
import {AddressModel} from "@opensimrs/model-sdk/setting";

export default class AddressRepository {
    static async getOrCreateBy(req) {
        return await sequelizeInstance.transaction(async tr => {
            return await AddressModel.findOrCreate({
                    where: {
                        uuid: req.uuid
                    },
                    transaction: tr,
                    attributes: ['uuid', 'prov', 'city', 'district', 'village', 'postal_code', 'full_address'],
                    defaults: {
                        faskesUuid: req.faskesUuid,
                    }
                },
            );
        })
    }
}