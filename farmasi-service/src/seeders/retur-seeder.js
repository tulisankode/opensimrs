import {ReturItemModel, ReturModel} from "@opensimrs/model-sdk/farmasi";
import {toEpochDate} from "../helpers/date-helper.js";

export default class ReturSeeder {
    static async seed(transaction) {
        const retur = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "jenis_retur": "obat",
                "no_resep": "resep99",
                "no_reg": "123",
                "rekam_medis_uuid": "123",
                "patient_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "no_rm": "123",
                "order_date": toEpochDate(Date.now()),
                "total": 100000,
                "lokasi_stok_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "alasan_retur": "rusak",
                "petugas_retur": "admin",
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475r",
                "jenis_retur": "alkes",
                "no_order_alkes": "ORD198FK",
                "no_reg": "123",
                "rekam_medis_uuid": "123",
                "patient_uuid": "0192b31f-365d-731c-8b16-3a4565c9475j",
                "no_rm": "123",
                "order_date": toEpochDate(Date.now()),
                "total": 100000,
                "lokasi_stok_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "alasan_retur": "rusak",
                "petugas_retur": "admin",
            },
        ];

        await ReturModel.bulkCreate(retur, { transaction });

        const returItem = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "retur_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "prescription_item_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "qty_retur": 1,
                "expired_date": Date.now(),
                "harga_satuan": 10000,
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475r",
                "retur_uuid": "0192b31f-365d-731c-8b16-3a4565c9475r",
                "order_alkes_item_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "qty_retur": 1,
                "expired_date": Date.now(),
                "harga_satuan": 10000,
            },
        ]

        await ReturItemModel.bulkCreate(returItem, { transaction });
    }
}