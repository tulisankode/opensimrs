import FpoPemberianModel from "../models/fpo-pemberian-model.js";

export default class FpoPemberianSeeder {
    static async seed(transaction) {
        const item = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "jam_pemberian" :1731305299000,
                "nama_pemberi" : "Dr. Adam",
                "note" : "Pemberian pertama",
                "prescription_item_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e"
            },
        ];

        await FpoPemberianModel.bulkCreate(item, { transaction });

    }
}
