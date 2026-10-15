import {OrderAlkesItemModel} from "@opensimrs/model-sdk/farmasi";

export default class OrderAlkesItemSeeder {
    static async seed(transaction) {
        const item = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "order_alkes_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "item_medis_uuid": "alkes1-365d-731c-8b16-3a4565c9475r",
                "qty" : 10,
                "harga_satuan" : 1000,
                "jenis_stok_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "alkes-365d-731c-8b16-3a4565c9475r",
                "order_alkes_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "item_medis_uuid": "alkes-365d-731c-8b16-3a4565c9475r",
                "qty" : 10,
                "harga_satuan" : 1000,
                "jenis_stok_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9474e",
                "order_alkes_uuid": "0192b31f-365d-731c-8b16-3a4565c9474e",
                "item_medis_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "qty" : 10,
                "harga_satuan" : 1000,
                "jenis_stok_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
            },{
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9473e",
                "order_alkes_uuid": "0192b31f-365d-731c-8b16-3a4565c9473e",
                "item_medis_uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "qty" : 10,
                "harga_satuan" : 1000,
                "jenis_stok_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
            },
        ];

        await OrderAlkesItemModel.bulkCreate(item, { transaction });
    }
}