import CaraiPakaiModel from "../models/cara-pakai-model.js";

export default class CaraPakaiSeeder {
    static async seed(transaction) {
        const caraPakai = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "code" : "tln",
                "cara_pakai" : "ditelan",
                "status" : true,
            },
        ];

        await CaraiPakaiModel.bulkCreate(caraPakai, { transaction });
    }
}