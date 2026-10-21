import {PrescriptionModel, OrderAlkesModel} from "@opensimrs/model-sdk/farmasi";

export default class RiwayatRepository {
    static async getRiwayatResep(req){
        return await PrescriptionModel.findAll()
    }

    // Detail riwayat hanya boleh dibuka untuk transaksi milik faskes pengguna (faskes dari JWT).
    static async milikFaskes(itemType, uuid, faskesUuid){
        const model = itemType === "alkes" ? OrderAlkesModel : PrescriptionModel;
        const jumlah = await model.count({ where: { uuid, faskes_uuid: faskesUuid } });
        return jumlah > 0;
    }
}
