import PrescriptionItemRacikanModel from "../models/prescription-item-racikan-model.js";

export default class PrescriptionItemRacikanSeeder {
    static async seed(transaction) {
        const racikan = [
            {
                "faskes_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475r",
                "item_medis_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_qty": 5,
                "prescription_item_uuid": "0192b31f-365d-731c-8b16-3a4565c9475t",
                "jenis_stok_uuid" : "prudential-365d-731c-8b16-3a4565c9475e",
            },
            {
                "faskes_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "item_medis_uuid": "0192b31f-365d-731c-8b16-3a4565c9475r",
                "medication_qty": 5,
                "prescription_item_uuid": "0192b31f-365d-731c-8b16-3a4565c9475t",
                "jenis_stok_uuid" : "prudential-365d-731c-8b16-3a4565c9475e",
            },
            {
                "faskes_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475t",
                "item_medis_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_qty": 5,
                "prescription_item_uuid": "0192b31f-365d-731c-8b16-3a4565c9475t",
                "jenis_stok_uuid" : "prudential-365d-731c-8b16-3a4565c9475e",
            }
        ];

        await PrescriptionItemRacikanModel.bulkCreate(racikan, { transaction });
    }
}