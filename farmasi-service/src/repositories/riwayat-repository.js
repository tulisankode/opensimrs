import {PrescriptionModel} from "@opensimrs/model-sdk/farmasi";

export default class RiwayatRepository {
    static async getRiwayatResep(req){
        return await PrescriptionModel.findAll()
    }
}