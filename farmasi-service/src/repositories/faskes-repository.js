import {FaskesModel} from "@opensimrs/model-sdk/datamaster";
import {AddressModel, FaskesProfilesModel} from "@opensimrs/model-sdk/setting";

export default class FaskesRepository {
    static async getFaskes(uuid){
        return await FaskesModel.findOne({
            where: {uuid},
            attributes : ["name"]
        });
    }

    static async getFaskesProfile(faskes_uuid){
        return await FaskesProfilesModel.findOne({
            where: {uuid: faskes_uuid},
            attributes : ["name"],
            include: [
                {
                    model: AddressModel,
                    as: "address",
                    attributes: ["full_address"],
                    required: false
                }
            ]
        });
    }
}