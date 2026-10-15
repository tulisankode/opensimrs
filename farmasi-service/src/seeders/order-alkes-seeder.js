import {OrderAlkesModel} from "@opensimrs/model-sdk/farmasi";

export default class OrderAlkesSeeder {
    static async seed(transaction) {
        const alkes = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "no_reg": "REG1234",
                "no_rm": "string",
                "patient_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "lokasi_stok_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "jenis_pelayanan" : "igd",
                "no_order_alkes" : "ORD12OFK2",
                "order_status" : 1,
                "petugas_order" : "sujiwo",
                "rekam_medis_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "rekam_medis_date" : "2021-01-01",
                "harga_total" : 10000,
                "lokasi_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "payment_method" : 1,
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9474e",
                "no_reg": "REG1234",
                "no_rm": "string",
                "patient_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "lokasi_stok_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "jenis_pelayanan" : "igd",
                "no_order_alkes" : "ORD12OFK1",
                "order_status" : 2,
                "petugas_order" : "sujiwo",
                "rekam_medis_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "rekam_medis_date" : "2021-01-01",
                "harga_total" : 10000,
                "lokasi_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "payment_method" : 2,
            },
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9473e",
                "no_reg": "REG1234",
                "no_rm": "string",
                "patient_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "lokasi_stok_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "jenis_pelayanan" : "igd",
                "no_order_alkes" : "ORD12OFK3",
                "order_status" : 3,
                "petugas_order" : "sujiwo",
                "rekam_medis_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "rekam_medis_date" : "2021-01-01",
                "harga_total" : 10000,
                "lokasi_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "payment_method" : 1,
            },
        ];

        await OrderAlkesModel.bulkCreate(alkes, { transaction });
    }
}