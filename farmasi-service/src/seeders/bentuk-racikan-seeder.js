import {BentukRacikanModel} from "@opensimrs/model-sdk/farmasi";

export default class BentukRacikanSeeder {
    static async seed(transaction) {
        const item = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "nama_bentuk_racikan" : "obat kuat",
                "jumlah" : 1,
                "tarif_embalase" : 1000,
                "tarif_racik" : 2000,
            },
        ];

        await BentukRacikanModel.bulkCreate(item, { transaction });
    }
}