import PrescriptionItemModel from "../models/prescription-item-model.js";

export default class PrescriptionItemSeeder {
    static async seed(transaction) {
        const prescriptionItem = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_qty" : 1,
                "sisa_qty_order" : 1,
                "item_medis_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_dose_qty" : 1,
                "medication_dose_satuan_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_period" : "hari",
                "aturan_pakai_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "cara_pakai_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "prescription_notes" : "",
                "is_chronic" : true,
                "route" : "anal",
                "prescription_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "jenis_stok_uuid" : "prudential-365d-731c-8b16-3a4565c9475e",
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475t",
                "medication_qty" : 1,
                "sisa_qty_order" : 1,
                "item_medis_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_dose_qty" : 1,
                "medication_dose_satuan_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_period" : "hari",
                "aturan_pakai_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "cara_pakai_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "prescription_notes" : "",
                "is_chronic" : true,
                "route" : "anal",
                "is_compound" : true,
                "prescription_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "bentuk_racikan_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "jenis_stok_uuid" : "prudential-365d-731c-8b16-3a4565c9475e",
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475r",
                "medication_qty" : 1,
                "sisa_qty_order" : 1,
                "item_medis_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_dose_qty" : 1,
                "medication_dose_satuan_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "medication_period" : "hari",
                "aturan_pakai_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "cara_pakai_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "prescription_notes" : "",
                "is_chronic" : false,
                "route" : "anal",
                "jenis_stok_uuid" : "prudential-365d-731c-8b16-3a4565c9475e",
                "prescription_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
            },
        ];

        await PrescriptionItemModel.bulkCreate(prescriptionItem, { transaction });
    }
}