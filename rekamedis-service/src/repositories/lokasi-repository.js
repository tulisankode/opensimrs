import {LokasiModel} from "@opensimrs/model-sdk/datamaster";

export default class LokasiRepository{
    static async getByUuid(uuid) {
        return await LokasiModel.findOne({
            where : {
                uuid: uuid,
                deleted_at: null
            },
            attributes: ["uuid"]
        })
    }
}