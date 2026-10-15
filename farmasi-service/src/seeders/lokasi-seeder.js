import {LokasiModel} from "@opensimrs/model-sdk/datamaster";
import {DataTypes} from "sequelize";

export default class LokasiSeeder {
    static async seed(transaction) {
        const item = [
            {
                "faskes_uuid" : "0192b31f-365d-731c-8b16-3a4565c9475e",
                "uuid": "0192b31f-365d-731c-8b16-3a4565c9475e",
                "code" : "mataa",
                "name" : "polii mata",
                "description" : "ini poli mata buat akatsuki",
                "phone" : "080000000000",
                "email" : "pengguna5@contoh.id",
                "url" : "http://localhost:8080",
                "status_operasional" : "non-occupied",
                "satu_sehat_id" : "123456789",
                "org_id" : "123456789",
                "location_type" : "gubuk",
                "class_code" : "123456789",
                "class_name" : "poli",
                "part_of_name" : "poli",
                "part_of" : "123456789",
                "code_antrian_poli" : "123456789",
                "is_poli" : true,
                "status" : true
            },
        ];

        await LokasiModel.bulkCreate(item, { transaction });
    }
}